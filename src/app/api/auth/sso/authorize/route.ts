// GET /api/auth/sso/authorize?redirect=<lab-callback-url>
//
// 返回 JSON { authorizeUrl, state }（不是 302！axios 默认会 follow 302
// 到 saas，触发 CORS）。客户端 `window.location.href = data.authorizeUrl`
// 是 top-level navigation，不受 CORS 限制。
//
// 与 msw handler 的形状对齐：
//   saas 端 msw 的 handler 也是返 JSON。

import { NextResponse } from "next/server";

const SAAS_BASE_URL = process.env.SAAS_BASE_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = url.searchParams.get("redirect") ?? "/";
  const state = url.searchParams.get("state") ?? "mock-state";

  // 把 lab 的 redirect URI + state 编码进 saas 登录页的 redirect 参数
  const saasUrl = new URL("/login", SAAS_BASE_URL);
  saasUrl.searchParams.set("redirect", redirect);
  saasUrl.searchParams.set("state", state);

  return NextResponse.json({
    authorizeUrl: saasUrl.toString(),
    state,
  });
}
