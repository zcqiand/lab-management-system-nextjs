// requireTenant — BFF 全域 token 化（2026-09-23）的统一租户身份入口。
//
// 语义对齐 ADR-0019 + aspnetcore HttpTenantContext / springboot currentTenant：
// 租户身份只来自 Authorization Bearer JWT 的 tenant_id claim，缺失即 401，
// 禁 demo 字面量兜底（此前硬编码 TENANT-001 / 完全不过滤的两个世界分叉见
// seed-db.ts SSO 数据面桥注释）。
//
// 401 信封与 contracts POST（2026-09-16 T11）逐字节一致；auth/me 的
// 「Bearer token required」是 sub 语义，不经本 helper。
import { NextResponse } from "next/server";
import { tenantIdFromBearer } from "./bearer";

export type TenantAuth = { tenantId: string } | NextResponse;

const UNAUTHORIZED_401 = () =>
  NextResponse.json(
    { code: "UNAUTHORIZED", message: "tenant_id claim is required (ADR-0019)" },
    { status: 401 },
  );

/** 解出 tenant_id claim → { tenantId }；否则返回 401 Response（调用方直接 return 短路）。 */
export function requireTenant(req: Request): TenantAuth {
  const tenantId = tenantIdFromBearer(req.headers.get("authorization"));
  if (!tenantId) return UNAUTHORIZED_401();
  return { tenantId };
}
