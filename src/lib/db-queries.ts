// src/lib/db-queries.ts — DB 数据访问层：row↔DTO 映射 + 各路由域查询/写入函数。
// 语义真相源 = 各 route.ts 头部注释所引的 lab-msw handler 行为。
// 映射器实现零 import 放在 db-map.ts（seed 脚本复用）；本文件 re-export，
// 域查询函数（真正 import { db, schema } from "@/db"）追加在下方。
export {
  TENANT,
  toCamel,
  toSnake,
  rowToDto,
  dtoToRow,
  PG_TABLES,
} from "./db-map";

// ———— receipts 域（Task 4：三态流转 SQL + applyFlowActionDb 事务）————
//
// 语义对齐 src/app/api/receipts/route.ts（msw in-memory 版，同款过滤族）与
// src/lib/api-helpers.ts applyFlowAction（flow 流转，2026-08-16 修订版）。
// FK 列空串在库里是 null 不是 ''（seed 归一，carried ruling 3）：DTO 保持 null
// 原样返回，不转回 ''。
import { and, eq, ne, desc, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { TENANT as TENANT_ID, rowToDto as toDto } from "./db-map";

type Row = Record<string, unknown>;

/**
 * receipt 行 → DTO：toDto 兜底命名 + issuedAt 归一化。
 * 列是 timestamp(mode:'string')，但 drizzle PgTimestampString 未覆写
 * mapFromDriverValue，postgres-js 把 timestamptz 读回 Date 对象——msw 版
 * issuedAt 是 ISO 字符串，这里统一转回 string（JSON 序列化形状与 msw 一致）。
 */
function receiptToDto(row: Row): Row {
  const dto = toDto(row);
  if (dto.issuedAt instanceof Date) dto.issuedAt = dto.issuedAt.toISOString();
  return dto;
}

export interface ListReceiptsQuery {
  flowStatus?: string;
  contractId?: string;
  categoryCode?: string;
  lastSubmittedBy?: string;
  operator?: string;
  keyword?: string;
  filter?: string;
  page: number;
  pageSize: number;
}

/** 列表查询（tenant 隔离 + 三态 filter + 精确过滤 + keyword + 分页）。 */
export async function listReceiptsDb(q: ListReceiptsQuery): Promise<{
  items: Row[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const t = schema.sampleReceipts;
  const conds = [eq(t.tenantId, TENANT_ID)];
  // 三态 filter（FlowStagePage）语义相对 flowStatus 环节（与 msw handler 同款）：
  //   not_yet   = 停在本环节待提交（无 flowStatus 时 = 无流转记录的新单）
  //   submitted = 已从本环节 submit 至下一环节（history 有 submit from 本环节且
  //               当前不在本环节）；无 flowStatus 时 = 有流转记录且记录了提交人
  if (q.filter === "not_yet") {
    conds.push(
      q.flowStatus
        ? eq(t.flowStatus, q.flowStatus as never)
        : dsql`jsonb_array_length(${t.flowHistory}) = 0`,
    );
  } else if (q.filter === "submitted") {
    if (q.flowStatus) {
      conds.push(ne(t.flowStatus, q.flowStatus as never));
      conds.push(
        dsql`exists (select 1 from jsonb_array_elements(${t.flowHistory}) h
          where h->>'action' = 'submit' and h->>'from' = ${q.flowStatus})`,
      );
    } else {
      conds.push(
        dsql`jsonb_array_length(${t.flowHistory}) > 0 and ${t.lastSubmittedBy} is not null`,
      );
    }
  } else if (q.flowStatus) {
    conds.push(eq(t.flowStatus, q.flowStatus as never));
  }
  if (q.contractId) conds.push(eq(t.contractId, q.contractId));
  if (q.categoryCode) conds.push(eq(t.categoryCode, q.categoryCode));
  if (q.lastSubmittedBy) conds.push(eq(t.lastSubmittedBy, q.lastSubmittedBy));
  if (q.operator)
    conds.push(
      dsql`(${t.receivedBy} = ${q.operator} or ${t.testOperator} = ${q.operator})`,
    );
  if (q.keyword) {
    const k = `%${q.keyword.toLowerCase()}%`;
    conds.push(
      dsql`(lower(${t.commissionCode}) like ${k}
        or lower(coalesce(${t.projectName}, '')) like ${k})`,
    );
  }
  const where = and(...conds);
  const rows = await db
    .select()
    .from(t)
    .where(where)
    .orderBy(desc(t.commissionDate))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const counted = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(t)
    .where(where);
  return {
    // drizzle select() 返回 camelCase 属性行（jsonb 已反序列化为 JS 数组），
    // toDto 兜底统一形状（幂等：camelCase 输入经 toCamel 不变）。
    items: rows.map((r) => receiptToDto(r as Row)),
    page: q.page,
    pageSize: q.pageSize,
    total: counted[0]?.n ?? 0,
  };
}

/** 单条查询（tenant 隔离）。 */
export async function getReceiptDb(id: string): Promise<Row | undefined> {
  const t = schema.sampleReceipts;
  const rows = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.tenantId, TENANT_ID)))
    .limit(1);
  return rows[0] ? receiptToDto(rows[0] as Row) : undefined;
}

// ———— flow 状态流转（事务版；语义照抄 api-helpers.ts applyFlowAction）————

export const FLOW_ORDER_FULL = [
  "receiving",
  "task_assignment",
  "data_entry",
  "review",
  "approval",
  "issuance",
  "archived",
  "completed",
] as const;

export type FlowStatusFull = (typeof FLOW_ORDER_FULL)[number];
export type FlowActionFull = "submit" | "return" | "withdraw";

export type FlowActionResult =
  | { id: string; ok: true; flowStatus: string }
  | { id: string; ok: false; message: string };

/**
 * submit/return/withdraw 单条流转（事务 + select for update）。
 * 语义逐字段对齐 api-helpers.ts applyFlowAction（2026-08-16 修订版）：
 *   - submit：前进一阶 + lastSubmittedBy=operator + to==='issuance' 补 issuedAt
 *   - return：后退一阶，不动 lastSubmittedBy（msw 版同款）
 *   - withdraw：后退一阶 + 清 lastSubmittedBy，仅限 lastSubmittedBy===operator
 *   - history：append { action, from, to, operator, at, reason }（JS 读出→push→整列写回）
 *   - updatedAt：重写为 now
 * 成功/失败都以值返回（不 throw），与 msw 版 applyFlowAction 的返回形状一致。
 */
export async function applyFlowActionDb(
  id: string,
  action: FlowActionFull,
  operator: string,
  reason?: string,
): Promise<FlowActionResult> {
  const t = schema.sampleReceipts;
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.tenantId, TENANT_ID)))
      .for("update")
      .limit(1);
    const r = rows[0] as
      | (Row & {
          flowStatus: string;
          lastSubmittedBy: string | null;
          issuedAt: string | null;
          flowHistory: unknown[];
        })
      | undefined;
    if (!r) return { id, ok: false as const, message: "Receipt not found" };
    const idx = FLOW_ORDER_FULL.indexOf(r.flowStatus as FlowStatusFull);
    if (idx < 0)
      return { id, ok: false as const, message: `Unknown flowStatus: ${r.flowStatus}` };
    const to =
      action === "submit" ? FLOW_ORDER_FULL[idx + 1] : FLOW_ORDER_FULL[idx - 1];
    if (!to) {
      return {
        id,
        ok: false as const,
        message:
          action === "submit" ? "Already at final stage" : "Already at first stage",
      };
    }
    // withdraw 仅限本人最近提交的单据（提交人主动收回）
    if (action === "withdraw" && r.lastSubmittedBy !== operator) {
      return { id, ok: false as const, message: "只能撤回本人提交的单据" };
    }
    const from = r.flowStatus;
    const hist = [
      ...(Array.isArray(r.flowHistory) ? r.flowHistory : []),
      { action, from, to, operator, at: now, reason },
    ];
    const updated = await tx
      .update(t)
      .set({
        flowStatus: to as never,
        lastSubmittedBy: action === "submit" ? operator : null,
        issuedAt:
          action === "submit" && to === "issuance" ? now : (r.issuedAt as never),
        flowHistory: hist as never,
        updatedAt: now,
      })
      .where(and(eq(t.id, id), eq(t.tenantId, TENANT_ID)))
      .returning();
    const after = updated[0] as Row | undefined;
    return { id, ok: true as const, flowStatus: String(after?.flowStatus ?? to) };
  });
}

/**
 * PUT 全量更新（msw 版 Object.assign 语义 = body 键覆盖 + updatedAt 重写 +
 * id/tenantId 不可改）。body 键过滤到 schema 已知列后走类型化 update，
 * jsonb（JS 数组直传，列 codec 自动 stringify）/ timestamp（string mode）由
 * drizzle 列映射处理。未知键静默丢弃（msw 版会带上，但 SQL 侧没有归宿）。
 */
export async function putReceiptDb(id: string, body: Row): Promise<Row | undefined> {
  const t = schema.sampleReceipts;
  const existing = await getReceiptDb(id);
  if (!existing) return undefined;
  const patch: Row = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (k === "id" || k === "tenantId") continue;
    if (!(k in t)) continue;
    patch[k] = v;
  }
  const rows = await db
    .update(t)
    .set(patch as never)
    .where(and(eq(t.id, id), eq(t.tenantId, TENANT_ID)))
    .returning();
  return rows[0] ? receiptToDto(rows[0] as Row) : undefined;
}

/** DELETE（返回是否删了行；tenant 隔离）。 */
export async function deleteReceiptDb(id: string): Promise<boolean> {
  const t = schema.sampleReceipts;
  const deleted = await db
    .delete(t)
    .where(and(eq(t.id, id), eq(t.tenantId, TENANT_ID)))
    .returning({ id: t.id });
  return deleted.length > 0;
}
