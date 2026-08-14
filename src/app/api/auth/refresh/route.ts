import { NextResponse } from "next/server";

// POST /api/auth/refresh — Demo: 永返回 mock token

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
  const username = String(body.refreshToken ?? "admin").replace(/^mock-refresh-/, "") || "admin";
  return NextResponse.json({
    token: `mock-jwt-${username}`,
    refreshToken: `mock-refresh-${username}`,
    user: { id: "USER-A", username, displayName: username, roleCode: "admin" },
    tenants: DEMO_TENANTS,
  });
}
