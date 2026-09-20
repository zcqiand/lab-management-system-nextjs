// src/lib/db-queries.ts — DB 数据访问层：row↔DTO 映射 + 各路由域查询/写入函数。
// 语义真相源 = 各 route.ts 头部注释所引的 lab-msw handler 行为。
// 映射器实现零 import 放在 db-map.ts（seed 脚本复用）；本文件 re-export，
// 域查询函数（真正 import { db, schema } from "@/db"）追加在下方。
export { TENANT, toCamel, toSnake, rowToDto, dtoToRow, PG_TABLES } from "./db-map";

// ———— receipts 域（Task 4：三态流转 SQL + applyFlowActionDb 事务）————
//
// 语义对齐 src/app/api/receipts/route.ts（msw in-memory 版，同款过滤族）与
// src/lib/api-helpers.ts applyFlowAction（flow 流转，2026-08-16 修订版）。
// FK 列空串在库里是 null 不是 ''（seed 归一，carried ruling 3）：DTO 保持 null
// 原样返回，不转回 ''。
import { and, asc, eq, ne, desc, inArray, or, ilike, sql as dsql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { TENANT as TENANT_ID, rowToDto as toDto, toCamel } from "./db-map";

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
    // 字段集对齐 msw 版 route（commissionCode/reportCode/receivedBy 三字段）；
    // ilike 是纯增强（不改变 msw 区分大小写匹配的结果集语义边界）
    const k = `%${q.keyword}%`;
    conds.push(
      dsql`(${t.commissionCode} ilike ${k}
        or ${t.reportCode} ilike ${k}
        or ${t.receivedBy} ilike ${k})`,
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

// ———— flow 状态流转（M03 7 阶段全 act 模式；stage-guard 版 actForStageDb 是
// 唯一写路径——2026-09-17 SSOT 清理删除了 stage 无关的 applyFlowActionDb
// 及其私生路由 POST /api/receipts/flow）————

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
 * M03 7 阶段全 act 模式（2026-09-17 SSOT 清理 Phase B1）：stage-guard 版批量流转。
 * 语义对齐 springboot ReportFlowService.actForStage / aspnetcore ReportFlowService.ActForStage
 * （契约 SSOT = shared sample-receipts.tsp 7 个 act op；本仓此前用私生
 * POST /api/receipts/flow 实现 stage 无关版本，已删）：
 *   - receipt 必须处于路径 stage 对应的 flowStatus，不匹配该条 ok:false
 *     "Stage mismatch: requires X but is Y"
 *   - submit→下一阶 / return→上一阶；withdraw 仅 receiving 合法（自转移）
 *   - archived 终态只收 submit（自转移，history 追加当 audit，reason 缺省
 *     "archived: post-archive audit"）
 *   - 每条独立事务（select for update），单条失败不拖垮整批
 * 附加维护（nextjs 侧既有约定，不影响跨后端比对面）：submit 写 lastSubmittedBy、
 * 进入 issuance 补 issuedAt；withdraw 清 lastSubmittedBy。
 */
const ACT_STAGE_TO_STATUS: Record<string, FlowStatusFull> = {
  receiving: "receiving",
  assigning: "task_assignment",
  "data-entry": "data_entry",
  review: "review",
  approve: "approval",
  issuance: "issuance",
  archived: "archived",
};

export async function actForStageDb(
  stagePath: string,
  ids: string[],
  action: FlowActionFull,
  operator: string,
  reason?: string,
): Promise<FlowActionResult[]> {
  const required = ACT_STAGE_TO_STATUS[stagePath];
  if (!required) throw new Error(`Unknown act stage: ${stagePath}`);
  const results: FlowActionResult[] = [];
  for (const id of ids) {
    results.push(await actOneForStage(id, required, action, operator, reason));
  }
  return results;
}

async function actOneForStage(
  id: string,
  required: FlowStatusFull,
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
    if (!r) return { id, ok: false as const, message: `Receipt not found: ${id}` };
    const current = r.flowStatus as FlowStatusFull;
    if (current !== required) {
      return {
        id,
        ok: false as const,
        message: `Stage mismatch: requires ${required} but is ${current}`,
      };
    }
    // 终态 archived：只收 submit，自转移写 history 当 audit（springboot 同款）
    let to: FlowStatusFull | undefined;
    if (required === "archived") {
      if (action !== "submit") {
        return {
          id,
          ok: false as const,
          message: `Invalid transition from ${current} with ${action}`,
        };
      }
      to = "archived";
    } else {
      const idx = FLOW_ORDER_FULL.indexOf(current);
      to =
        action === "submit"
          ? FLOW_ORDER_FULL[idx + 1]
          : action === "return"
            ? FLOW_ORDER_FULL[idx - 1]
            : // withdraw 仅 receiving 合法（自转移，对齐 springboot/aspnetcore）
              current === "receiving"
              ? "receiving"
              : (undefined as never);
      if (!to) {
        return {
          id,
          ok: false as const,
          message: `Invalid transition from ${current} with ${action}`,
        };
      }
    }
    const hist = [
      ...(Array.isArray(r.flowHistory) ? r.flowHistory : []),
      {
        action,
        from: current,
        to,
        operator,
        at: now,
        reason:
          required === "archived" && reason === undefined
            ? "archived: post-archive audit"
            : reason,
      },
    ];
    const updated = await tx
      .update(t)
      .set({
        flowStatus: to as never,
        lastSubmittedBy:
          action === "submit"
            ? operator
            : action === "withdraw"
              ? null
              : (r.lastSubmittedBy as never),
        issuedAt: action === "submit" && to === "issuance" ? now : (r.issuedAt as never),
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

/**
 * INSERT（route 侧组好含 id/tenantId 的完整 DTO；id 生成保留路由 newId 模式）。
 * 列过滤到 schema 已知列（未知键静默丢弃，同 putReceiptDb）；必填列缺失或
 * FK 违反（contract_id / category_code restrict）由数据库抛错，路由层兜底。
 */
export async function createReceiptDb(dto: Row): Promise<Row> {
  const t = schema.sampleReceipts;
  const values: Row = {};
  for (const [k, v] of Object.entries(dto)) {
    if (k in t) values[k] = v;
  }
  const rows = await db
    .insert(t)
    .values(values as never)
    .returning();
  return receiptToDto(rows[0] as Row);
}

/** 连接类错误判定（路由层 503 兜底用；postgres-js 的连接错误带 code 属性）。 */
export function isDbUnavailable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null | undefined;
  if (!err) return false;
  if (
    err.code &&
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(err.code)
  )
    return true;
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect ECONNREFUSED|DATABASE_URL is not set/i.test(
    String(err.message ?? ""),
  );
}

// ———— dict / catalog 域（Batch1：16 条 dict + catalog 路由从 msw fixture 数组接真库）————
//
// 语义真相源 = src/lib/api-helpers.ts wrapDict（dict 8 表）与
// src/lib/catalog-handlers.ts catalogGet/Post/Put/Delete（catalog 4 表）的
// fixture 版实现（golden 快照对比逐字节对齐，.tmp-batch1-golden/）。
// 契约红线（ADR-0015）：响应形状 / 过滤参数族 / 分页语义 / 状态码 / 错误文案零改动。

export interface DictAggregateCfg {
  /** 聚合列名（如 parameterNames / standardCodes / objectNames） */
  as: string;
  /** junction 表 */
  link: PgTable;
  /** link 表里指向本表 code 的列 */
  selfCol: PgColumn;
  /** link 表里指向对端 code 的列 */
  otherCol: PgColumn;
  /** 对端码表（提供 code→name 映射；wrapDict aggregate.names 兜底语义：name 缺失回落 code） */
  names?: { table: PgTable; code: PgColumn; name: PgColumn };
}

export interface DictReverseHop {
  link: PgTable;
  /** 靠参数一侧的列 */
  from: PgColumn;
  /** 靠本表 code 一侧的列 */
  to: PgColumn;
}

export interface DictCfg {
  /** 主表（须有 code/name 列） */
  table: PgTable;
  code: PgColumn;
  name: PgColumn;
  /** query 参数 → 直列等值过滤（wrapDict「key in items[0]」分支） */
  direct: Record<string, PgColumn>;
  /** query 参数 → junction 反查链（wrapDict junctions.reverse；逐跳 EXISTS） */
  reverse: Record<string, DictReverseHop[]>;
  /** 聚合列（wrapDict junctions.aggregate；分页后逐行补列） */
  aggregate: DictAggregateCfg[];
  /** tenant 列：catalog 4 表有 tenant_id；dict 4 表 schema 无此列（SSOT schema.ts），
   * fixture 版本本就无 tenant 过滤，dict 侧保持全局可见（种子行全部 TENANT-001 域）。 */
  tenantCol?: PgColumn;
  /** 排序列：缺省按 code 单键。两键合一仍是全序（code 唯一）。 */
  sortCol?: PgColumn;
  /** POST 重复 code 的 400 文案（fixture 版 getSpecialty(code) 分支原句） */
  dupMessage: string;
}

/** wrapDict num() 同款：Number(v) 有限且 > 0 才认，否则回落默认。 */
function posNum(v: string | null | undefined): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * junction 反查链 → EXISTS 子查询。
 *
 * 【忠实复刻 wrapDict 的既有语义，含其怪癖】wrapDict reverse 的逐跳 Set 传递：
 *   allowed 初值 null → 第一跳 filter 放行「全部」link 行（查询参数值从未参与过滤！），
 *   后续跳只按上一跳结果串联。因此 ?inspectionObjectCode=X 对 parameters 的
 *   实际语义是「在 junction 链上有挂链的行保留」（X 本身被忽略）——
 *   golden 对比实证：params_by_object 旧版返 560（有任一挂链的参数），非按值过滤的 19。
 * 本函数产出等价 EXISTS（只约束链上连通 + 末跳 to=本表 code，不用 value）：
 *   单跳 exists (select 1 from link where link.to = t.code)
 *   两跳 exists (select 1 from l0 join l1 on l1.from = l0.to where l1.to = t.code)
 * value 仅决定「链是否启用」（query 参数出现与否），与 wrapDict 相同。
 * 链内各 link 表互不相同（现配置均满足），无需别名。
 */
function reverseExists(hops: DictReverseHop[], selfCode: PgColumn) {
  let joins = dsql``;
  for (let i = 1; i < hops.length; i++) {
    const hop = hops[i]!;
    const prev = hops[i - 1]!;
    joins = dsql`${joins} join ${hop.link} on ${hop.from} = ${prev.to}`;
  }
  const first = hops[0]!;
  const last = hops[hops.length - 1]!;
  return dsql`exists (select 1 from ${first.link}${joins}
    where ${last.to} = ${selfCode})`;
}

function dictWhere(cfg: DictCfg, q: ListDictQuery) {
  const conds = [];
  if (cfg.tenantCol) conds.push(eq(cfg.tenantCol, TENANT_ID));
  // keyword：wrapDict 是 JS includes（区分大小写的字面子串）——strpos 字面匹配
  // 精确同语义（不用 ilike：那是不区分大小写的增强，超出 wrapDict 契约）。
  if (q.keyword)
    conds.push(
      dsql`strpos(${cfg.code}, ${q.keyword}) > 0 or strpos(${cfg.name}, ${q.keyword}) > 0`,
    );
  const direct = q.direct ?? {};
  for (const [param, col] of Object.entries(cfg.direct)) {
    const v = direct[param];
    if (v) conds.push(eq(col, v));
  }
  for (const [param, hops] of Object.entries(cfg.reverse)) {
    if (direct[param]) conds.push(reverseExists(hops, cfg.code));
  }
  return conds.length ? and(...conds) : undefined;
}

export interface ListDictQuery {
  /** wrapDict keyword：code/name 字面子串（区分大小写） */
  keyword?: string;
  /** 直列 / junction 反查过滤参数（仅收路由声明支持的参数；wrapDict 对未知参数静默忽略） */
  direct?: Record<string, string>;
  /** 1-based 页码（调用方已按 num(…,1) 归一） */
  page: number;
  /**
   * pageSize 原始 query 串：wrapDict 缺省/非法 → 全量（items.length || 1，空集 → 1），
   * 由本函数在 count 之后解析（默认值依赖 total）。
   */
  pageSizeParam?: string | null;
}

/**
 * dict 行 → DTO：camelCase 兜底 + id=code 补列（dict 表无 id 列，wrapDict 同款 patch）
 * + null 键剔除。msw 快照 JSON 契约里不存在 null 值（可空列无值时整个键缺位，
 * golden 实证：standards 的 version/sourceDocumentId/sourceHash 均如此），
 * DB 出库 null → 删键，保证响应键集与 fixture 版逐键一致。
 */
function dictRowToDto(row: Row, patchId: boolean): Row {
  const dto = toDto(row);
  for (const k of Object.keys(dto)) {
    if (dto[k] === null || dto[k] === undefined) delete dto[k];
  }
  if (patchId) dto.id = String(dto.code);
  return dto;
}

/**
 * 列表查询（tenant 隔离[若有列] + keyword + 直列/junction 反查过滤 + count 先行 + 分页）。
 * 响应 = wrapDict 的 Page<T> 4 字段 {items, page, pageSize, total}。
 * ORDER BY (sortCol, code)：与 springboot/aspnetcore 家族约定一致（两者均
 * OrderBy(SortOrder).ThenBy(Code)）。「堆序 = 入库序 = fixture 数组序」的原假设
 * 在测试写路径（DELETE/POST 清场回收）长期搅动堆后失稳——同名检测项目
 * （OBJ-SP01-P2 / OBJ-SP07-P11）在树里的先后随机翻转，前端「首个匹配」点击
 * 不再确定（2026-09-18 react gate 牌号种子穿透用例实证）。
 */
export async function listDictDb(
  cfg: DictCfg,
  q: ListDictQuery,
): Promise<{ items: Row[]; page: number; pageSize: number; total: number }> {
  const where = dictWhere(cfg, q);
  // count 先行：pageSize 缺省值 = total（wrapDict items.length || 1 同款）
  const counted = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(cfg.table)
    .where(where);
  const total = counted[0]?.n ?? 0;
  const pageSize = posNum(q.pageSizeParam) ?? (total || 1);
  const rows = (await db
    .select()
    .from(cfg.table)
    .where(where)
    .orderBy(...(cfg.sortCol ? [asc(cfg.sortCol), asc(cfg.code)] : [asc(cfg.code)]))
    .limit(pageSize)
    .offset((q.page - 1) * pageSize)) as Row[];
  const items = rows.map((r) => dictRowToDto(r, true));
  if (cfg.aggregate.length && items.length) await fillAggregates(cfg, items);
  return { items, page: q.page, pageSize, total };
}

/**
 * 聚合列（wrapDict aggregate 语义逐字复刻）：分页后逐行补 out[as] =
 * dedup(link 里 self=本行code 的对端 code → name 兜底 code).join('，')。
 * 在 JS 侧而非 string_agg 做：Set 保序去重 + name 兜底 + 空串剔除的行为
 * 逐字节可对齐 fixture 版（SQL DISTINCT 聚合不保插入序）。
 */
async function fillAggregates(cfg: DictCfg, items: Row[]) {
  const selfCodeKey = toCamel(cfg.code.name);
  const codes = items.map((r) => String(r[selfCodeKey]));
  for (const a of cfg.aggregate) {
    const selfKey = toCamel(a.selfCol.name);
    const otherKey = toCamel(a.otherCol.name);
    const linkRows = (await db
      .select()
      .from(a.link)
      .where(inArray(a.selfCol, codes))) as Row[];
    let names: Map<string, string> | undefined;
    if (a.names) {
      const codeKey = toCamel(a.names.code.name);
      const nameKey = toCamel(a.names.name.name);
      const otherCodes = [
        ...new Set(linkRows.map((l) => String(l[otherKey] ?? "")).filter(Boolean)),
      ];
      const nameRows =
        otherCodes.length > 0
          ? ((await db
              .select()
              .from(a.names.table)
              .where(inArray(a.names.code, otherCodes))) as Row[])
          : [];
      names = new Map(nameRows.map((r) => [String(r[codeKey]), String(r[nameKey])]));
    }
    for (const item of items) {
      item[a.as] = [
        ...new Set(
          linkRows
            .filter((l) => String(l[selfKey] ?? "") === String(item[selfCodeKey] ?? ""))
            .map((l) => {
              const code = String(l[otherKey] ?? "");
              return names?.get(code) ?? code;
            })
            .filter(Boolean),
        ),
      ].join("，");
    }
  }
}

/** 单条查询（detail GET；wrapDict 不补 id —— 明细响应就是裸行）。 */
export async function getDictDb(cfg: DictCfg, code: string): Promise<Row | undefined> {
  const conds = [eq(cfg.code, code)];
  if (cfg.tenantCol) conds.push(eq(cfg.tenantCol, TENANT_ID));
  const rows = (await db
    .select()
    .from(cfg.table)
    .where(and(...conds))
    .limit(1)) as Row[];
  return rows[0] ? dictRowToDto(rows[0], false) : undefined;
}

export type CreateDictResult = { ok: true; row: Row } | { ok: false; message: string };

/**
 * INSERT（POST）。fixture 版先查重（getSpecialty(code)）返 400 文案——同样先查，
 * 命中返 {ok:false, message:cfg.dupMessage}，路由层映射 400。
 * 列过滤到 schema 已知列（未知键静默丢弃）；tenant 表强制 TENANT_ID
 * （否则 tenant 过滤的 GET 永远看不见新行）。
 */
export async function createDictDb(cfg: DictCfg, body: Row): Promise<CreateDictResult> {
  const code = String(body.code ?? "");
  if (await getDictDb(cfg, code)) return { ok: false, message: cfg.dupMessage };
  const values: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (k in cfg.table) values[k] = v;
  }
  // code 以后处理兜底（body 可能缺 code 键——route 侧已保证非空）
  values.code = code;
  if (cfg.tenantCol) values.tenantId = TENANT_ID;
  const rows = (await db
    .insert(cfg.table)
    .values(values as never)
    .returning()) as Row[];
  return { ok: true, row: dictRowToDto(rows[0] as Row, false) };
}

/**
 * PUT 全量更新（fixture 版 Object.assign(r, body, { code: r.code, updatedAt }) 语义 =
 * body 键覆盖 + code/tenantId 不可改 + updatedAt 重写；未知键无列归宿静默丢弃）。
 */
export async function putDictDb(
  cfg: DictCfg,
  code: string,
  body: Row,
): Promise<Row | undefined> {
  const existing = await getDictDb(cfg, code);
  if (!existing) return undefined;
  const patch: Row = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (k === "code" || k === "tenantId") continue;
    if (!(k in cfg.table)) continue;
    patch[k] = v;
  }
  const conds = [eq(cfg.code, code)];
  if (cfg.tenantCol) conds.push(eq(cfg.tenantCol, TENANT_ID));
  const rows = (await db
    .update(cfg.table)
    .set(patch as never)
    .where(and(...conds))
    .returning()) as Row[];
  return rows[0] ? dictRowToDto(rows[0], false) : undefined;
}

/** DELETE（返回是否删了行；tenant 隔离[若有列]）。 */
export async function deleteDictDb(cfg: DictCfg, code: string): Promise<boolean> {
  const conds = [eq(cfg.code, code)];
  if (cfg.tenantCol) conds.push(eq(cfg.tenantCol, TENANT_ID));
  const deleted = await db
    .delete(cfg.table)
    .where(and(...conds))
    .returning({ code: cfg.code });
  return deleted.length > 0;
}

// ———— dict / catalog 表配置（语义 = 各 route.ts 头部注释所引 wrapDict / catalogHandlers）————
//
// junction 链（与 wrapDict 调用点逐跳对应；语义见 reverseExists 注释——
// 「链上挂链即保留」，查询值不参与过滤，与 fixture 版逐字节对齐）：
//   专项→参数：specialty_objects → object_parameters
//   专项→标准：specialty_objects → object_standards
//   项目→参数：object_parameters          标准→参数：standard_parameters
//   项目→标准：object_standards

const sp = schema.inspectionSpecialties;
const obj = schema.inspectionObjects;
const param = schema.inspectionParameters;
const std = schema.inspectionStandards;
const specObj = schema.inspectionSpecialtyObjects;
const objParam = schema.inspectionObjectParameters;
const objStd = schema.inspectionObjectStandards;
const stdParam = schema.inspectionStandardParameters;

/** M06 dict 4 表配置（inspection/{specialties,objects,parameters,standards}）。 */
export const DICT_CFGS = {
  specialties: {
    table: sp,
    code: sp.code,
    name: sp.name,
    sortCol: sp.sortOrder,
    direct: {},
    reverse: {},
    aggregate: [],
    dupMessage: "专项编码已存在",
  },
  objects: {
    table: obj,
    code: obj.code,
    name: obj.name,
    sortCol: obj.sortOrder,
    direct: { inspectionSpecialtyCode: obj.inspectionSpecialtyCode },
    reverse: {},
    aggregate: [
      {
        as: "parameterNames",
        link: objParam,
        selfCol: objParam.inspectionObjectCode,
        otherCol: objParam.inspectionParameterCode,
        names: { table: param, code: param.code, name: param.name },
      },
      {
        as: "standardCodes",
        link: objStd,
        selfCol: objStd.inspectionObjectCode,
        otherCol: objStd.inspectionStandardCode,
      },
    ],
    dupMessage: "项目编码已存在",
  },
  parameters: {
    table: param,
    code: param.code,
    name: param.name,
    sortCol: param.sortOrder,
    direct: {},
    reverse: {
      inspectionSpecialtyCode: [
        {
          link: specObj,
          from: specObj.inspectionSpecialtyCode,
          to: specObj.inspectionObjectCode,
        },
        {
          link: objParam,
          from: objParam.inspectionObjectCode,
          to: objParam.inspectionParameterCode,
        },
      ],
      inspectionObjectCode: [
        {
          link: objParam,
          from: objParam.inspectionObjectCode,
          to: objParam.inspectionParameterCode,
        },
      ],
      inspectionStandardCode: [
        {
          link: stdParam,
          from: stdParam.inspectionStandardCode,
          to: stdParam.inspectionParameterCode,
        },
      ],
    },
    aggregate: [
      {
        as: "objectNames",
        link: objParam,
        selfCol: objParam.inspectionParameterCode,
        otherCol: objParam.inspectionObjectCode,
        names: { table: obj, code: obj.code, name: obj.name },
      },
      {
        as: "standardCodes",
        link: stdParam,
        selfCol: stdParam.inspectionParameterCode,
        otherCol: stdParam.inspectionStandardCode,
      },
    ],
    dupMessage: "参数编码已存在",
  },
  standards: {
    table: std,
    code: std.code,
    name: std.name,
    sortCol: std.sortOrder,
    direct: {},
    reverse: {
      inspectionSpecialtyCode: [
        {
          link: specObj,
          from: specObj.inspectionSpecialtyCode,
          to: specObj.inspectionObjectCode,
        },
        {
          link: objStd,
          from: objStd.inspectionObjectCode,
          to: objStd.inspectionStandardCode,
        },
      ],
      inspectionObjectCode: [
        {
          link: objStd,
          from: objStd.inspectionObjectCode,
          to: objStd.inspectionStandardCode,
        },
      ],
    },
    aggregate: [
      {
        as: "parameterNames",
        link: stdParam,
        selfCol: stdParam.inspectionStandardCode,
        otherCol: stdParam.inspectionParameterCode,
        names: { table: param, code: param.code, name: param.name },
      },
    ],
    dupMessage: "标准编码已存在",
  },
} satisfies Record<string, DictCfg>;

/** M04 catalog 4 表配置（catalog/{brands,models,specs,grades}；同构，tenant 列齐全）。 */
function catalogCfg(
  table: PgTable & {
    code: PgColumn;
    name: PgColumn;
    sortOrder: PgColumn;
    inspectionObjectCode: PgColumn;
    tenantId: PgColumn;
  },
): DictCfg {
  return {
    table,
    code: table.code,
    name: table.name,
    sortCol: table.sortOrder,
    // catalogGet 只认 inspectionObjectCode 直列过滤（keyword 不支持——fixture 版静默忽略）
    direct: { inspectionObjectCode: table.inspectionObjectCode },
    reverse: {},
    aggregate: [],
    tenantCol: table.tenantId,
    dupMessage: "编码已存在",
  };
}

/** catalog 4 表（Batch1 接真库；catalog-handlers.ts 改为薄封装调本表）。 */
export const CATALOG_CFGS = {
  brands: catalogCfg(schema.inspectionBrands),
  models: catalogCfg(schema.inspectionModels),
  specs: catalogCfg(schema.inspectionSpecs),
  grades: catalogCfg(schema.inspectionGrades),
} satisfies Record<string, DictCfg>;

// ———— report-names 域（T11 fixtures→PG：nextjs dev 的 recompile 会重置
// transpilePackages 内联模块的内存状态，fixtures 数组写入蒸发——live gate 实证
// 「POST 201 后 [code] 路由 404」。对齐 receipts 批次做法，数据源切 lab_dev；
// 契约面（路径/信封/状态码）不变。语义真相源 = 各 route.ts 头注引 lab-msw handler。）———

const RN_MAIN = schema.inspectionReportNames;
const RN_LINKS = {
  object: schema.inspectionObjectReportNames,
  standard: schema.inspectionReportNameStandards,
  parameter: schema.inspectionReportNameParameters,
} as const;
export type ReportNameLinkKind = keyof typeof RN_LINKS;

/** 主表 list（全量；keyword/分页信封仍由路由层 wrapDict 统一处理）。 */
export async function listReportNamesDb(): Promise<Row[]> {
  return (await db.select().from(RN_MAIN)) as Row[];
}

export async function getReportNameDb(code: string): Promise<Row | null> {
  const rows = await db.select().from(RN_MAIN).where(eq(RN_MAIN.code, code));
  return (rows[0] as Row) ?? null;
}

export async function createReportNameDb(dto: Row): Promise<Row> {
  await db.insert(RN_MAIN).values({
    code: String(dto.code ?? ""),
    name: String(dto.name ?? ""),
    fullName: (dto.fullName as string | null) ?? null,
    templatePath: (dto.templatePath as string | null) ?? null,
    summaryName: (dto.summaryName as string | null) ?? null,
    extFields: (dto.extFields as unknown) ?? null,
    description: (dto.description as string | null) ?? null,
    sortOrder: (dto.sortOrder as number | undefined) ?? 0,
    createdAt: String(dto.createdAt ?? ""),
    updatedAt: String(dto.updatedAt ?? ""),
  });
  return dto;
}

/** PUT 语义 = msw Object.assign：只覆盖 body 给出的字段，code/createdAt 不动。 */
const RN_MAIN_COLUMNS = [
  "name",
  "fullName",
  "templatePath",
  "summaryName",
  "extFields",
  "description",
  "sortOrder",
] as const;

export async function updateReportNameDb(code: string, patch: Row): Promise<Row | null> {
  const sets: Row = {};
  for (const k of RN_MAIN_COLUMNS) {
    if (k in patch) sets[k] = patch[k] as never;
  }
  sets.updatedAt = String(patch.updatedAt ?? "");
  const rows = await db
    .update(RN_MAIN)
    .set(sets)
    .where(eq(RN_MAIN.code, code))
    .returning();
  return (rows[0] as Row) ?? null;
}

export async function deleteReportNameDb(code: string): Promise<boolean> {
  const rows = await db.delete(RN_MAIN).where(eq(RN_MAIN.code, code)).returning();
  return rows.length > 0;
}

/** junction list（全量；query 过滤仍由路由层 wrapLinks 统一处理）。 */
export async function listReportNameLinksDb(kind: ReportNameLinkKind): Promise<Row[]> {
  return (await db.select().from(RN_LINKS[kind])) as Row[];
}

/** junction POST：msw 版是裸 push（204 恒定）；PG 主键冲突按幂等 upsert 处理仍 204。 */
export async function createReportNameLinkDb(
  kind: ReportNameLinkKind,
  dto: Row,
): Promise<void> {
  await db
    .insert(RN_LINKS[kind])
    .values(dto as never)
    .onConflictDoNothing();
}

/** junction DELETE：msw linkDelete 按 query 全键匹配删一行（未命中也 204）。
 * query 键是 camelCase DTO 字段，直接对 junction 表的 camel 属性列建等值条件。 */
export async function deleteReportNameLinkDb(
  kind: ReportNameLinkKind,
  query: URLSearchParams,
): Promise<void> {
  const t = RN_LINKS[kind];
  const conds = Array.from(query.keys())
    .filter((k) => k in t)
    .map((k) => eq(t[k as keyof typeof t] as PgColumn, query.get(k) as string));
  if (conds.length === 0) return;
  await db.delete(t).where(and(...conds));
}

// ———— contracts 域（T11：msw fixtures 内存数组 → PG 迁移）————
//
// 三后端共库（V015 seed）：aspnetcore/springboot 的 contracts 直写 lab_dev PG，
// nextjs fixtures 版是唯一不入库的漂移源 —— 本进程 POST 的合同 receipts POST
// 做.contract FK 校验时 23503 → 500（gate #4 Cluster B 实证）。
// 语义真相源 = lab-msw handlers-extra contractsExtraHandlers：status/keyword 过滤 +
// 分页 + 必填 6 项 400；这些信封/校验语义仍由路由层持有，本层只管行读写。
// 响应行来自 PG returning：未填可空列落 null（不是 undefined），
// 与 aspnetcore DTO 物化形状对齐（POST shape 四方比对 Cluster E 的分叉根因）。

/** 可经 POST/PUT 写的列（id/tenantId/createdAt 由路由层控制，不收 body）。 */
const CONTRACT_COLUMNS = [
  "contractCode",
  "clientUnit",
  "projectName",
  "projectLocation",
  "constructionUnit",
  "inspectionSpecialtyCode",
  "buildingUnit",
  "supervisorUnit",
  "inspectionPerson",
  "inspectionPhone",
  "witnessUnit",
  "witness",
  "witnessPhone",
  "contactPerson",
  "contactPhone",
  "entrustedDate",
  "status",
] as const;

export interface ListContractsQuery {
  status?: string;
  keyword?: string;
}

/** 列表（status / keyword 过滤；keyword 对 contractCode/projectName 做 case-insensitive contains，
 *  与 msw toLowerCase().includes() 同语义 → SQL ilike）。分页信封由路由层 pageOf 处理。 */
export async function listContractsDb(q: ListContractsQuery): Promise<Row[]> {
  const t = schema.contracts;
  const conds = [];
  if (q.status) conds.push(eq(t.status, q.status));
  if (q.keyword) {
    const like = `%${q.keyword}%`;
    conds.push(or(ilike(t.contractCode, like), ilike(t.projectName, like)));
  }
  const rows = conds.length
    ? await db
        .select()
        .from(t)
        .where(and(...conds))
    : await db.select().from(t);
  return rows as Row[];
}

export async function getContractDb(id: string): Promise<Row | null> {
  const rows = await db
    .select()
    .from(schema.contracts)
    .where(eq(schema.contracts.id, id));
  return (rows[0] as Row) ?? null;
}

/** POST：白名单列 + 路由层已校验的必填 6 项；同租户 contractCode 撞
 *  idx_contracts_tenant_code 唯一索引时 PG 23505 向上抛（路由层转 400）。 */
export async function createContractDb(dto: Row): Promise<Row> {
  const t = schema.contracts;
  const values: Row = { id: dto.id, tenantId: dto.tenantId };
  for (const k of CONTRACT_COLUMNS) {
    if (k in dto && dto[k] !== undefined) values[k] = dto[k];
  }
  values.createdAt = String(dto.createdAt ?? "");
  values.updatedAt = String(dto.updatedAt ?? "");
  const rows = await db
    .insert(t)
    .values(values as never)
    .returning();
  return rows[0] as Row;
}

/** PUT 语义 = msw Object.assign：只覆盖 body 给出的字段（白名单内），id/tenantId 不动。 */
export async function updateContractDb(id: string, patch: Row): Promise<Row | null> {
  const t = schema.contracts;
  const sets: Row = {};
  for (const k of CONTRACT_COLUMNS) {
    if (k in patch && patch[k] !== undefined) sets[k] = patch[k];
  }
  sets.updatedAt = String(patch.updatedAt ?? "");
  const rows = await db.update(t).set(sets).where(eq(t.id, id)).returning();
  return (rows[0] as Row) ?? null;
}

export async function deleteContractDb(id: string): Promise<boolean> {
  const rows = await db
    .delete(schema.contracts)
    .where(eq(schema.contracts.id, id))
    .returning();
  return rows.length > 0;
}
