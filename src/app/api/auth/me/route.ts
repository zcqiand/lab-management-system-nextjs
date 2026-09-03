// GET /api/auth/me — 当前用户会话（user + 关联租户 + 当前选中）
//
// 2026-09-03 租户体系对齐（aspnetcore 仓 docs/superpowers/specs/2026-09-03-me-tenant-alignment-design.md）：
//   - 有 Authorization: Bearer（SSO 用户，token = saas accessToken 原样透传，见
//     sso/callback 注释 §3）→ 解 sub 读 memberships 快照：
//       hit  → 返回 saas 租户体系（与 sso/callback 返回的 tenants 同源，前端
//              hydrateAuth 的 tenants.find(localStorage.activeTenantId) 必命中）
//       miss → 401 MEMBERSHIP_UNAVAILABLE（前端 catch 走 /api/auth/refresh
//              自愈 —— refresh 会重填快照）
//   - 无 Bearer（demo 路径）→ demo 用户 + demo 租户（现状不变）

import { NextResponse } from "next/server";
import { getMembershipSnapshot } from "@/lib/auth/membership-snapshot";

// 2026-09-02 契约收敛：username=alice（四方统一，见 lib/auth/directory.ts）
const DEMO_USER = { id: "USER-A", username: "alice", displayName: "管理员", roleCode: "admin" };
const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

/** 从 Authorization: Bearer <jwt> 解 JWT payload sub（不验签 - 与 menus route
 *  同款语义：本仓 demo 路由不校验 JWT；快照 key 是 sub，伪造 sub 只能拿到
 *  别人的租户快照，demo 阶段可接受）。 */
function subFromBearer(authz: string | null): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request?: Request) {
  // request 可缺省（demo 直调/旧 wiring 测试无参调用 = 无 Bearer 的 demo 路径）
  const sub = subFromBearer(request?.headers.get("authorization") ?? null);
  if (sub !== null) {
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
    return NextResponse.json({
      user: DEMO_USER,
      tenants,
      currentTenantId: tenants[0]?.tenantId ?? "",
    });
  }
  return NextResponse.json({
    user: DEMO_USER,
    tenants: DEMO_TENANTS,
    currentTenantId: "TENANT-001",
  });
}
