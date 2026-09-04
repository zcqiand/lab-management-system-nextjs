// POST /api/auth/switch-tenant — body { tenantId }
// 校验 tenantId 属于已知列表后返回新 token。
//
// ADR-0019：删「无 Bearer = 切到 demo USER-A」反模式。必须先有 Bearer 才能切租户。
// 2026-08-27 msw demo 兜底删除原则已对齐。

import { NextResponse } from "next/server";
import { subFromBearer } from "@/lib/auth/bearer";

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

export async function POST(req: Request) {
  // ADR-0019：未登录态直打 = 401
  const sub = subFromBearer(req.headers.get("authorization"));
  if (sub === null) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
      { status: 401 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { tenantId?: string };
  const tid = String(body.tenantId ?? "");
  if (!tid) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "tenantId is required" },
      { status: 400 },
    );
  }
  if (!DEMO_TENANTS.some((t) => t.tenantId === tid)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({
    token: `mock-jwt-tenant-${tid}`,
    refreshToken: `mock-refresh-tenant-${tid}`,
    // 2026-09-02 契约收敛：username=alice（四方统一，见 lib/auth/directory.ts）
    user: { id: sub, username: "alice", displayName: "管理员", roleCode: "admin" },
    tenants: DEMO_TENANTS,
  });
}
