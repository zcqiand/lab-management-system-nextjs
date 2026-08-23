// POST /api/auth/sso/callback { grant_type, code, redirect_uri, state }
//   -> LoginResponse { token, refreshToken, user, tenants }
//
// v0.3.46 真实链路（对齐 saas-nextjs OAuth 2.0 授权码模式 RFC 6749）：
//   1. POST saas /api/v1/oauth/token { grantType:"authorization_code", code,
//      clientId, clientSecret, tenantId, redirectUri } -> { accessToken, ... }
//   2. GET saas /api/v1/me (Bearer accessToken) -> CurrentUser（含 memberships）
//   3. 映射成 lab 的 LoginResponse：token = saas accessToken（lab 的 API
//      demo 路由不校验 JWT；接 RBAC 时透传给 saas 侧校验）
//
// 旧 demo 实现（无条件返 mock-jwt-USER-A）已废弃。

import { NextResponse } from "next/server";

const SAAS_BASE_URL = process.env.SAAS_BASE_URL ?? "http://localhost:3000";
// 与 authorize 路由同一组 client 配置（apps.clientId/clientSecret 见 saas seeds）
const SAAS_CLIENT_ID = process.env.SAAS_OAUTH_CLIENT_ID ?? "lab-mgmt";
const SAAS_CLIENT_SECRET =
  process.env.SAAS_OAUTH_CLIENT_SECRET ?? "lab-mgmt-secret";
const SAAS_TENANT_ID =
  process.env.SAAS_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";

type SaasTokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  message?: string;
};
type SaasMe = {
  id?: string;
  email?: string;
  displayName?: string;
  memberships?: Array<{
    tenantId: string;
    roleIds?: string[];
    status?: string;
  }>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    grant_type?: string;
    code?: string;
    redirect_uri?: string;
    state?: string;
  };

  if (body.grant_type !== "authorization_code" || !body.code || !body.redirect_uri) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: "grant_type=authorization_code, code, redirect_uri are required",
      },
      { status: 400 },
    );
  }

  // 1. code 换 saas token（confidential client，secret 只在本服务端）
  let tokenRes: SaasTokenResponse;
  try {
    const res = await fetch(`${SAAS_BASE_URL}/api/v1/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grantType: "authorization_code",
        code: body.code,
        clientId: SAAS_CLIENT_ID,
        clientSecret: SAAS_CLIENT_SECRET,
        tenantId: SAAS_TENANT_ID,
        redirectUri: body.redirect_uri,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    tokenRes = (await res.json().catch(() => ({}))) as SaasTokenResponse;
    if (!res.ok || !tokenRes.accessToken) {
      return NextResponse.json(
        {
          code: "SSO_TOKEN_FAILED",
          message: tokenRes.message ?? `saas token HTTP ${res.status}`,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        code: "SSO_TOKEN_UNREACHABLE",
        message: `连不上 saas（${SAAS_BASE_URL}）：${(err as Error).message}`,
      },
      { status: 502 },
    );
  }

  // 2. accessToken 拉当前用户（失败不阻塞登录，user/tenants 降级为最小信息）
  let me: SaasMe = {};
  try {
    const res = await fetch(`${SAAS_BASE_URL}/api/v1/me`, {
      headers: { authorization: `Bearer ${tokenRes.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) me = (await res.json()) as SaasMe;
  } catch {
    // /me 不可达：仍完成登录（token 已到手），只是身份信息缺省
  }

  // 3. 映射 lab LoginResponse（旧 demo 契约形状不变，前端 authStore 无感）
  const tenants = (me.memberships ?? [])
    .filter((m) => m.status !== "removed")
    .map((m) => ({
      tenantId: m.tenantId,
      tenantCode: m.tenantId,
      tenantName: m.tenantId,
    }));

  return NextResponse.json({
    token: tokenRes.accessToken,
    refreshToken: tokenRes.refreshToken ?? "",
    user: {
      id: me.id ?? "unknown",
      username: me.email ?? "unknown",
      displayName: me.displayName ?? me.email ?? "未知用户",
      roleCode: me.memberships?.[0]?.roleIds?.[0] ?? "member",
    },
    tenants,
  });
}
