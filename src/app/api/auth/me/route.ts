// GET /api/auth/me — 当前用户会话（user + 关联租户 + 当前选中）
//
// 2026-09-03 租户体系对齐（aspnetcore 仓 docs/superpowers/specs/2026-09-03-me-tenant-alignment-design.md）：
//   - 有 Authorization: Bearer（SSO 用户，token = saas accessToken 原样透传，见
//     sso/callback 注释 §3）→ 解 sub 读 memberships 快照：
//       hit  → 返回 saas 租户体系（与 sso/callback 返回的 tenants 同源，前端
//              hydrateAuth 的 tenants.find(localStorage.activeTenantId) 必命中）
//       miss → 401 MEMBERSHIP_UNAVAILABLE（前端 catch 走 /api/auth/refresh
//              自愈 —— refresh 会重填快照）
//
// ADR-0019：删「无 Bearer = DEMO_USER 兜底」反模式。无 Bearer 一律 401，与
// 2026-08-27 msw demo 兜底删除原则对齐。前端 useBackendMenus / authStore hydrate
// 必须先 login 拿 token。

import { NextResponse } from "next/server";
import { getMembershipSnapshot } from "@/lib/auth/membership-snapshot";
import { subFromBearer } from "@/lib/auth/bearer";

// 2026-09-02 契约收敛：username=alice（四方统一，见 lib/auth/directory.ts）
const DEMO_USER = { id: "USER-A", username: "alice", displayName: "管理员", roleCode: "admin" };

export async function GET(request: Request) {
  const sub = subFromBearer(request.headers.get("authorization"));
  if (sub === null) {
    // ADR-0019：无 Bearer = 401，不再返 DEMO_USER
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
      { status: 401 },
    );
  }
  const tenants = getMembershipSnapshot(sub);
  if (!tenants) {
    // miss 如实报错（可恢复态：前端 refresh / 重登重建快照）
    return NextResponse.json(
      {
        code: "MEMBERSHIP_UNAVAILABLE",
        message: `membership snapshot unavailable for user ${sub}; refresh to recover`,
      },
      { status: 401 },
    );
  }
  // ADR-0019 + P2 debt：与 msw/aspnetcore/springboot 3 真后端 /me 形态对齐。
  // msw 返 tenants[{tenantId, code, name, roleIds}],nextjs 原本只返 {tenantId, roleIds} 导致 4-way divergence。
  // 从 membership-snapshot 读 roleIds,DEMO_TENANTS 补 code/name(单源)。
  const DEMO_TENANTS_FULL: Record<string, { code: string; name: string }> = {
    "TENANT-001": { code: "city-lab", name: "市住建工程质量检测中心" },
    "TENANT-002": { code: "district-lab", name: "区检测站" },
    "TENANT-003": { code: "third-party", name: "第三方检测实验室" },
  };
  const fullTenants = tenants.map((t) => ({
    tenantId: t.tenantId,
    roleIds: t.roleIds,
    ...(DEMO_TENANTS_FULL[t.tenantId] ?? {}),
  }));
  return NextResponse.json({
    user: DEMO_USER,
    tenants: fullTenants,
    currentTenantId: fullTenants[0]?.tenantId ?? "",
  });
}
