// POST /api/auth/refresh — 凭 refreshToken 换新 token + 用户信息
//
// ADR-0019：删「refreshToken 缺失 = admin user」反模式。refreshToken 缺失或
// 无效一律 401，禁止 fallback 到 hardcoded admin 拿 admin JWT。

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
  const refreshToken = String(body.refreshToken ?? "").trim();
  if (!refreshToken) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "refreshToken required (ADR-0019)" },
      { status: 401 },
    );
  }
  // refreshToken 验签 / 续签留作 future;目前 dev 路径无真后端 → 400 而不是 401。
  // 401 留给「refreshToken 存在但无效」,目前不区分(同 dev 边界)。
  // 真路径要连 saas /api/v1/oauth/token (refresh grant) 换 accessToken。
  return NextResponse.json(
    {
      code: "REFRESH_NOT_IMPLEMENTED",
      message: "refresh path 走 saas /oauth/token grant_type=refresh_token,本仓 demo 暂未接通",
    },
    { status: 400 },
  );
}
