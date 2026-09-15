// GET /api/auth/sso/authorize?response_type=code&client_id&redirect_uri&state
//
// 返回 JSON { authorizeUrl, state }（不是 302！axios 默认会 follow 302
// 到 saas，触发 CORS）。客户端 `window.location.href = data.authorizeUrl`
// 是 top-level navigation，不受 CORS 限制。
//
// 跳板语义（2026-09-15 对齐 lab-springboot AuthService.ssoAuthorize /
// lab-aspnetcore v0.2.11 同款，mirror 家族标准流程）：
//   1. 本端点只拼 saas 登录页跳板 URL：`${SAAS_UI_BASE_URL}/login?redirect_uri&state&client_id`
//      —— 服务端**不做 code 预拿**。saas /api/v1/oauth/authorize 已收敛为必须
//      认证身份（code 绑 Bearer sub + tenant_id claim，禁匿名签 code），
//      服务端匿名预拿恒 401（曾表现为登录页 502 SSO_AUTHORIZE_FAILED）。
//   2. 用户在 saas 登录 → saas 写 session cookie → saas 前端 LoginPage 跳板分支
//      自动调 saas /oauth/authorize 拿 code → 302 回跳 redirect_uri?code&state。
//   3. lab /login 验 state -> POST /api/auth/sso/callback 换 lab 自家 JWT。
//
// SAAS_UI_BASE_URL (client+server) 指向登录 UI 页（/login 渲染端，dev=saas-nextjs :5101）。

import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env-required";

// ADR-0019：OAuth 凭据 (ui base / client_id) 缺失即 throw（requireEnv 抛 500）。
// 不允许 fallback 到 dev 字面值。
//
// 惰性求值：顶层调 requireEnv 会让 next build 的 "Collecting page data" 崩
// （Docker builder stage 没有 prod env）。运行时缺失仍 throw → 500。
const SAAS_UI_BASE_URL = () => requireEnv("SAAS_UI_BASE_URL");
const SAAS_CLIENT_ID = () => requireEnv("SAAS_OAUTH_CLIENT_ID");

export async function GET(request: Request) {
  const url = new URL(request.url);
  // ADR-0019：response_type / state 是 OAuth 安全关键参数,client 控制;
  // 缺失必须 400,不允许 fallback (state ?? "mock-state" 过去是 CSRF 防御绕过)。
  const responseType = url.searchParams.get("response_type");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (!responseType || !state) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "response_type and state are required" },
      { status: 400 },
    );
  }

  if (!redirectUri) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "redirect_uri is required" },
      { status: 400 },
    );
  }
  if (responseType !== "code") {
    return NextResponse.json(
      { code: "UNSUPPORTED_RESPONSE_TYPE", message: "仅支持 response_type=code" },
      { status: 400 },
    );
  }

  // 拼 saas 登录页跳板 URL：state/redirect_uri 原样透传 + client_id（RFC 6749
  // §4.1.1——saas LoginPage 跳板分支靠它触发 authorize）。code 由用户在 saas
  // 登录后由 saas 前端带 session 领取，本端点不预拿（2026-09-15 家族收敛）。
  const saasUrl = new URL("/login", SAAS_UI_BASE_URL());
  saasUrl.searchParams.set("redirect_uri", redirectUri);
  saasUrl.searchParams.set("state", state);
  saasUrl.searchParams.set("client_id", SAAS_CLIENT_ID());

  return NextResponse.json({
    authorizeUrl: saasUrl.toString(),
    state,
  });
}
