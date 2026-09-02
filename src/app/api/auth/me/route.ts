import { NextResponse } from "next/server";

// GET /api/auth/me — 当前用户会话（user + 关联租户 + 当前选中）

const currentTenantId = "TENANT-001";

// 2026-09-02 契约收敛：username=alice（四方统一，见 lib/auth/directory.ts）
const DEMO_USER = { id: "USER-A", username: "alice", displayName: "管理员", roleCode: "admin" };
const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

export async function GET() {
  return NextResponse.json({
    user: DEMO_USER,
    tenants: DEMO_TENANTS,
    currentTenantId,
  });
}
