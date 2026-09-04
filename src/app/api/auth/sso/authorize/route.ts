// GET /api/auth/sso/authorize?response_type=code&client_id&redirect_uri&state
//
// 返回 JSON { authorizeUrl, state }（不是 302！axios 默认会 follow 302
// 到 saas，触发 CORS）。客户端 `window.location.href = data.authorizeUrl`
// 是 top-level navigation，不受 CORS 限制。
//
// 真实链路（v0.3.45，对齐 saas-nextjs OAuth 2.0 授权码模式 RFC 6749）：
//   1. lab 后端（confidential client）POST saas /api/v1/oauth/authorize
//      { clientId, redirectUri, responseType:"code", scope, state, tenantId }
//      -> { code, state }
//   2. 拼 saas 登录页 `${SAAS_UI_BASE_URL}/login?code&redirect_uri&state`
//   3. 浏览器去 saas 认证，成功后 saas 302 redirect_uri?code&state 回 lab /login
//   4. lab /login 验 state -> POST /api/auth/sso/callback 换 lab 自家 JWT
//
// SAAS_IDP_URL (server-only) 与 SAAS_UI_BASE_URL (client+server) 拆分：
//   - SAAS_IDP_URL 指向 OAuth IdP（POST /api/v1/oauth/* 端点，saas-nextjs 全栈仓同 origin）
//   - SAAS_UI_BASE_URL 指向登录 UI 页（/login 渲染端，dev 同 saas-nextjs :3000，prod 同域）

import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env-required";

// ADR-0019：所有 OAuth 凭据 (idp url / ui base / client_id / tenant_id / scope)
// 缺失即 throw（由 requireEnv 抛 500）。不允许 fallback 到 dev 字面值。
const SAAS_IDP_URL = requireEnv("SAAS_IDP_URL");
const SAAS_UI_BASE_URL = requireEnv("SAAS_UI_BASE_URL");
const SAAS_CLIENT_ID = requireEnv("SAAS_OAUTH_CLIENT_ID");
const SAAS_TENANT_ID = requireEnv("SAAS_TENANT_ID");
const SAAS_SCOPE = requireEnv("SAAS_OAUTH_SCOPE");

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

  // 1. 向 saas IdP 领授权码（服务端对服务端，不经浏览器）
  let code: string;
  try {
    const authorizeRes = await fetch(
      `${SAAS_IDP_URL}/api/v1/oauth/authorize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: SAAS_CLIENT_ID,
          redirectUri,
          responseType: "code",
          scope: SAAS_SCOPE,
          state,
          tenantId: SAAS_TENANT_ID,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const authorizeData = (await authorizeRes.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    if (!authorizeRes.ok || !authorizeData.code) {
      return NextResponse.json(
        {
          code: "SSO_AUTHORIZE_FAILED",
          message: authorizeData.message ?? `saas authorize HTTP ${authorizeRes.status}`,
        },
        { status: 502 },
      );
    }
    code = authorizeData.code;
  } catch (err) {
    return NextResponse.json(
      {
        code: "SSO_AUTHORIZE_UNREACHABLE",
        message: `连不上 saas IdP（${SAAS_IDP_URL}）：${(err as Error).message}`,
      },
      { status: 502 },
    );
  }

  // 2. 拼 saas 登录页 URL：code + redirect_uri + state 原样透传（用 SAAS_UI_BASE_URL）
  const saasUrl = new URL("/login", SAAS_UI_BASE_URL);
  saasUrl.searchParams.set("code", code);
  saasUrl.searchParams.set("redirect_uri", redirectUri);
  saasUrl.searchParams.set("state", state);

  return NextResponse.json({
    authorizeUrl: saasUrl.toString(),
    state,
  });
}
