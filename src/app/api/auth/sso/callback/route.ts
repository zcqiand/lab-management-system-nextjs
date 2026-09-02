// POST /api/auth/sso/callback { grant_type, code, redirect_uri, state }
//   -> LoginResponse { token, refreshToken, user, tenants }
//
// v0.3.46 真实链路（对齐 saas-nextjs OAuth 2.0 授权码模式 RFC 6749）：
//   1. POST saas /api/v1/oauth/token { grantType:"authorization_code", code,
//      clientId, clientSecret, tenantId, redirectUri } -> { accessToken, ... }
//   2. GET saas /api/v1/me (Bearer accessToken) -> CurrentUser（含 memberships）
//   3. 映射成 lab 的 LoginResponse：token = saas accessToken（lab 的 API
//      demo 路由不校验 JWT；接 RBAC 时透传给 saas 侧校验）
//   4. ADR-0009（2026-08-25）：瞬时持 accessToken 时顺手拉 saas
//      /api/v1/me/menus 存快照缓存（menu-snapshot.ts，TTL 30min），
//      供 GET /api/auth/menus 按 sub 读取。失败只 warn 不阻塞登录。
//
// 旧 demo 实现（无条件返 mock-jwt-USER-A）已废弃。

import { NextResponse } from "next/server";
import { cacheMenuSnapshot } from "@/lib/auth/menu-snapshot";

// v0.3.56:SAAS_BASE_URL 是 Phase 4 对称化已删的死 key(线上一直吃 localhost
// fallback,token 换发 502)。真名 SAAS_IDP_URL,与 sso/authorize 路由一致。
const SAAS_BASE_URL = process.env.SAAS_IDP_URL ?? "http://localhost:5101";
// 与 authorize 路由同一组 client 配置（apps.clientId/clientSecret 见 saas seeds）。
// 2026-08-28 V014/V015 收敛 apps.client_id 为 UUID '11111111-1111-1111-1111-111111111111'。
const SAAS_CLIENT_ID =
  process.env.SAAS_OAUTH_CLIENT_ID ?? "11111111-1111-1111-1111-111111111111";
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

  // 2.5 ADR-0009：瞬时持 accessToken 时拉菜单进快照缓存（失败只 warn）
  if (me.id) {
    await cacheMenuSnapshot(me.id, tokenRes.accessToken, SAAS_BASE_URL);
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
