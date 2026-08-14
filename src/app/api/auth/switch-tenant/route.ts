import { NextResponse } from "next/server";

// POST /api/auth/switch-tenant — body { tenantId }
// Demo: 校验 tenantId 属于已知列表后更新内部 singleton，返回新 token。

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tenantId?: string };
  const tid = String(body.tenantId ?? "");
  if (!DEMO_TENANTS.some((t) => t.tenantId === tid)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({
    token: `mock-jwt-tenant-${tid}`,
    refreshToken: `mock-refresh-tenant-${tid}`,
    user: { id: "USER-A", username: "admin", displayName: "管理员", roleCode: "admin" },
    tenants: DEMO_TENANTS,
  });
}
