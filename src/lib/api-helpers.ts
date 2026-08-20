// API route 共享 helpers —— 浏览器端 API routes（msw 模式同源代理）的公共层。
//
// 语义真相源是 tests/helpers/seed.ts 的 installShapeAdapters（REF 组件期望的
// 响应形状 + 过滤参数族）：dictCrud 裸数组 → {items,total}、junction 过滤、
// flow 完整流转语义。本文件把同一套语义下沉到 Next API route 层，供
// src/app/api/**/route.ts 复用；数据仍来自 @lab/management-system-msw/fixtures
// （in-memory，与 contracts 路由同款模式）。
import { NextResponse } from "next/server";
import {
  sampleReceipts,
  samples,
  inspectionParameters,
  inspectionObjects,
  inspectionSpecialtyObjects,
  inspectionObjectStandards,
  inspectionObjectParameters,
  inspectionStandardParameters,
  getReceipt,
} from "@lab/management-system-msw/fixtures";

export const NOW = () => new Date().toISOString();

export const TENANT = "TENANT-001";

export function pageOf<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
}

export function num(v: string | null, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

export function qp(req: Request): URLSearchParams {
  return new URL(req.url).searchParams;
}

export function notFound(msg: string) {
  return NextResponse.json({ code: "NOT_FOUND", message: msg }, { status: 404 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ code: "BAD_REQUEST", message: msg }, { status: 400 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

// ———— wrapDict / wrapLinks / linkDelete：移植自 tests/helpers/seed.ts ————

type Row = Record<string, unknown>;

export interface DictJunctions {
  selfCodeKey?: string;
  reverse?: Record<string, Array<{ link: Row[]; from: string; to: string }>>;
  aggregate?: Array<{
    as: string;
    link: Row[];
    selfCol: string;
    otherCol: string;
    names?: Map<string, string>;
  }>;
}

/** M06 主表：补 id=code + keyword 过滤 + junction 反查/聚合列（REF 语义）。 */
export function wrapDict(rows: Row[], req: Request, junctions?: DictJunctions) {
  const selfCodeKey = junctions?.selfCodeKey ?? "code";
  const url = new URL(req.url);
  const withId: Row[] = rows.map((r) => ({
    ...r,
    id: String(r["id"] ?? r[selfCodeKey]),
  }));
  let items = withId;
  const kw = url.searchParams.get("keyword") ?? "";
  if (kw)
    items = items.filter(
      (r) => String(r["code"] ?? "").includes(kw) || String(r["name"] ?? "").includes(kw),
    );
  for (const key of [
    "inspectionSpecialtyCode",
    "inspectionObjectCode",
    "inspectionStandardCode",
    "inspectionParameterCode",
  ]) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    if (items.length > 0 && key in (items[0] as Row)) {
      items = items.filter((r) => r[key] === v);
    } else if (junctions?.reverse?.[key]) {
      let allowed: Set<string> | null = null;
      for (const hop of junctions.reverse[key]) {
        const next = new Set(
          hop.link
            .filter((l) => allowed === null || allowed.has(String(l[hop.from] ?? "")))
            .map((l) => String(l[hop.to] ?? ""))
            .filter(Boolean),
        );
        allowed = next;
      }
      items = allowed ? items.filter((r) => allowed!.has(String(r[selfCodeKey] ?? ""))) : items;
    }
  }
  const paged = pageOf(
    items,
    num(url.searchParams.get("page"), 1),
    num(url.searchParams.get("pageSize"), items.length || 1),
  );
  if (!junctions?.aggregate?.length) return NextResponse.json(paged);
  return NextResponse.json({
    ...paged,
    items: paged.items.map((r) => {
      const out: Row = { ...r };
      for (const a of junctions.aggregate!) {
        out[a.as] = [
          ...new Set(
            a.link
              .filter((l) => String(l[a.selfCol] ?? "") === String(r[selfCodeKey] ?? ""))
              .map((l) => {
                const code = String(l[a.otherCol] ?? "");
                return a.names?.get(code) ?? code;
              })
              .filter(Boolean),
          ),
        ].join("，");
      }
      return out;
    }),
  });
}

/** M06 junction：query 参数 → 列精确匹配（键=query 参数名=列名）。
 *
 * <p>返 TypeSpec `Page<T>` 4 字段（items / page / pageSize / total）以与
 * shared openapi.yaml `Page<T>` 一致；SpringBoot / msw 同步返 4 字段，
 * 本仓不返 4 字段会让跨后端切到 'nextjs' 时收到 2 字段 shape，
 * 已在 lab-react/lab-vue 的 unwrapListResponse 兼容；本函数顺手补齐 4 字段。
 */
export function wrapLinks(rows: Row[], req: Request, filterKeys: Record<string, string>) {
  const url = new URL(req.url);
  let items: Row[] = rows;
  for (const [param, col] of Object.entries(filterKeys)) {
    const v = url.searchParams.get(param);
    if (v) items = items.filter((r) => r[col] === v);
  }
  const page = num(url.searchParams.get("page"), 1);
  const pageSize = num(url.searchParams.get("pageSize"), items.length || 1);
  return NextResponse.json({ items, total: items.length, page, pageSize });
}

/** junction DELETE：REF 组件发 query 参数（apiClient.delete(url, { params })），
 * 按 query 键匹配原地删除（含 extraFields 键如 role）。未命中也 204（幂等）。 */
export async function linkDelete(req: Request, arr: Row[]) {
  const url = new URL(req.url);
  const keys = Array.from(url.searchParams.keys());
  let idx = -1;
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!row) continue;
    const hit = keys.every((k) => String(row[k] ?? "") === url.searchParams.get(k));
    if (hit) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) arr.splice(idx, 1);
  return noContent();
}

// ———— flow 状态流转语义（与 tests/helpers/seed.ts Task 11 适配一致）————

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

interface ReceiptRow {
  id: string;
  commissionCode?: string;
  flowStatus: string;
  lastSubmittedBy?: string | null;
  issuedAt?: string | null;
  flowHistory?: unknown[];
  updatedAt?: string;
  [k: string]: unknown;
}

/** submit/return/withdraw 单条流转（原地写 fixtures；语义同 Task 11 适配层）。 */
export function applyFlowAction(
  r: ReceiptRow,
  action: FlowActionFull,
  operator: string,
  reason?: string,
): { id: string; ok: true; flowStatus: string } | { id: string; ok: false; message: string } {
  const now = NOW();
  const idx = FLOW_ORDER_FULL.indexOf(r.flowStatus as FlowStatusFull);
  if (idx < 0) return { id: r.id, ok: false, message: `Unknown flowStatus: ${r.flowStatus}` };
  const to = action === "submit" ? FLOW_ORDER_FULL[idx + 1] : FLOW_ORDER_FULL[idx - 1];
  if (!to) {
    return {
      id: r.id,
      ok: false,
      message: action === "submit" ? "Already at final stage" : "Already at first stage",
    };
  }
  // withdraw 仅限本人最近提交的单据（提交人主动收回）
  if (action === "withdraw" && r.lastSubmittedBy !== operator) {
    return { id: r.id, ok: false, message: "只能撤回本人提交的单据" };
  }
  const from = r.flowStatus;
  r.flowStatus = to;
  if (action === "submit") {
    r.lastSubmittedBy = operator;
    if (to === "issuance") r.issuedAt = now;
  } else if (action === "withdraw") {
    r.lastSubmittedBy = null;
  }
  (r.flowHistory ??= []).push({ action, from, to, operator, at: now, reason });
  r.updatedAt = now;
  return { id: r.id, ok: true, flowStatus: r.flowStatus };
}

export function findReceipt(id: string): ReceiptRow | undefined {
  return getReceipt(id) as ReceiptRow | undefined;
}

export {
  sampleReceipts,
  samples,
  inspectionObjects,
  inspectionParameters,
  inspectionSpecialtyObjects,
  inspectionObjectStandards,
  inspectionObjectParameters,
  inspectionStandardParameters,
};
