import { NextResponse } from "next/server";

// POST /api/auth/login
// Demo: any non-empty user/password returns mock token + DEMO_USER.
// Real path (future): pg.Client → lab_dev.users 表校验 + 签 JWT。

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "username and password are required" },
      { status: 400 },
    );
  }
  return NextResponse.json({
    token: `mock-jwt-${username}`,
    refreshToken: `mock-refresh-${username}`,
    user: { id: "USER-A", username, displayName: username, roleCode: "admin" },
    tenants: DEMO_TENANTS,
  });
}
