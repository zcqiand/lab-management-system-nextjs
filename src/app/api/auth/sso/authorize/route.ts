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
//   2. 拼 saas 登录页 `${SAAS_BASE_URL}/login?code&redirect_uri&state`
//   3. 浏览器去 saas 认证，成功后 saas 302 redirect_uri?code&state 回 lab /login
//   4. lab /login 验 state -> POST /api/auth/sso/callback 换 lab 自家 JWT
//
// 旧版（拼 ?redirect=&state= 捷径）与 saas-nextjs 登录页已删除的旧约定
// 不匹配 -> 登录后跳 saas 自家首页而非回 lab，已废弃。

import { NextResponse } from "next/server";

const SAAS_BASE_URL = process.env.SAAS_BASE_URL ?? "http://localhost:3000";
// OAuth client_id：lab 在 saas 注册的应用（apps.client_id，见 saas seeds apps.json）。
const SAAS_CLIENT_ID = process.env.SAAS_OAUTH_CLIENT_ID ?? "lab-mgmt";
// dev mock 语义：authorize 端点要求 tenantId（该 tenant 下须有用户）。
// lab 登录前无租户上下文，用部署 env 注入，缺省取 saas 种子首个 tenant（acme）。
const SAAS_TENANT_ID =
  process.env.SAAS_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";
const SAAS_SCOPE = process.env.SAAS_OAUTH_SCOPE ?? "lab.read lab.write";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const responseType = url.searchParams.get("response_type") ?? "code";
  const clientId = url.searchParams.get("client_id") ?? SAAS_CLIENT_ID;
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "mock-state";

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

  // 1. 向 saas 领授权码（服务端对服务端，不经浏览器）
  let code: string;
  try {
    const authorizeRes = await fetch(
      `${SAAS_BASE_URL}/api/v1/oauth/authorize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
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
        message: `连不上 saas（${SAAS_BASE_URL}）：${(err as Error).message}`,
      },
      { status: 502 },
    );
  }

  // 2. 拼 saas 登录页 URL：code + redirect_uri + state 原样透传
  const saasUrl = new URL("/login", SAAS_BASE_URL);
  saasUrl.searchParams.set("code", code);
  saasUrl.searchParams.set("redirect_uri", redirectUri);
  saasUrl.searchParams.set("state", state);

  return NextResponse.json({
    authorizeUrl: saasUrl.toString(),
    state,
  });
}
