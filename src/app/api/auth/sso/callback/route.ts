// POST /api/auth/sso/callback { code, state } → LoginResponse
//
// demo：直接返 mock token（与 msw handler 行为对齐）。
// 真实链路：用 code + state 去 saas IdP 换 access_token。

import { NextResponse } from "next/server";

const DEMO_USER = {
  id: "USER-A",
  username: "admin",
  displayName: "管理员",
  roleCode: "admin",
};

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", tenantCode: "city-lab", tenantName: "市建科院" },
  { tenantId: "TENANT-002", tenantCode: "district-lab", tenantName: "区检测中心" },
  { tenantId: "TENANT-003", tenantCode: "third-party", tenantName: "第三方实验室" },
];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    state?: string;
  };

  // 没有 code/state 也接受 —— demo 容错（msw 端不校验）
  if (!body.code || !body.state) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "code and state are required" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    token: `mock-jwt-${DEMO_USER.id}`,
    refreshToken: `mock-refresh-${DEMO_USER.id}`,
    user: DEMO_USER,
    tenants: DEMO_TENANTS,
  });
}
