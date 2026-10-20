// POST /api/auth/login
//
// REQ-2026-023（2026-10-11 人裁方案 A）：账密校验代理化 saas IdP——请求体账密
// 调 saas /api/v1/auth/login（clientId=LAB_SAAS_CLIENT_ID），saas 200 → 映射
// LoginResponse（lab 自家 LabJwtSigner 重签，refresh 维持 dev-placeholder）。
// 本地 LAB_AUTH_DEV_PASSWORD / checkPassword 路径退役（凭据真源=saas 库）。
// 错误映射五仓统一：saas 4xx → 401 INVALID_CREDENTIALS（不透传 saas 内部码）；
// saas 5xx/不可达/超时 → 502 SAAS_UNAVAILABLE。native-login 路由 re-export
// 本 POST，两路径行为永不分叉。
//
// 2026-08-27 菜单快照（REQ-2026-023 非目标，行为不动）：登录成功后仍用服务
// 账号（LAB_SAAS_SERVICE_USER/PASSWORD/CLIENT_ID）serviceLogin 换 token 拉
// /me/menus 存快照（key = lab userId）。失败只 warn 不抛。miss 时 GET /menus
// 503 由前端 useBackendMenus 回退静态菜单。

import { NextResponse } from "next/server";
import { cacheMenuSnapshot, putMenuSnapshot } from "@/lib/auth/menu-snapshot";
import { putMembershipSnapshot } from "@/lib/auth/membership-snapshot";
import { putUserSnapshot } from "@/lib/auth/user-snapshot";
import { requireEnv } from "@/lib/env-required";
import { LabJwtSigner } from "@/lib/auth/jwt";
import { readLabConfig } from "@/lib/auth/factory";

// v0.3.56:SAAS_BASE_URL 是 Phase 4 对称化已删的死 key(deploy 脚本 L115 迁移删掉,
// 线上一直吃 localhost fallback 打容器内 3000,菜单快照静默 warn 失败)。
// 真名 SAAS_IDP_URL,与 sso/authorize 路由一致。
//
// ADR-0019：所有出站凭据 (idp url / client_id / service_user / service_password)
// 缺失即 throw（由 requireEnv 抛 500）。不允许 fallback 到字面值。
//
// 惰性求值（不在模块顶层调 requireEnv）：next build 的 "Collecting page data"
// 会 import 本模块，顶层求值等于要求 build 环境备齐 prod 凭据。Docker builder
// stage 没有（.env.production gitignored，不在 build context），build 直接崩。
// 放进函数体后 build 不求值，运行时缺失仍立即 throw → 500，fail-fast 语义不变。
const SAAS_BASE_URL = () => requireEnv("SAAS_IDP_URL");
const SERVICE_USER = () => requireEnv("LAB_SAAS_SERVICE_USER");
const SERVICE_PASSWORD = () => requireEnv("LAB_SAAS_SERVICE_PASSWORD");
// 5.37（对齐 5.33 springboot 379b6ee / aspnetcore 222db63）：saas LoginRequest
// 契约 clientId 必填——缺了 saas 直接 400，serviceLogin warn 落空菜单快照。
// 独立键（不复用 SAAS_OAUTH_CLIENT_ID），值形 = oauth_client code。
// ADR-0019：缺失即 throw，禁兜底字面量。
const SERVICE_CLIENT_ID = () => requireEnv("LAB_SAAS_SERVICE_CLIENT_ID");
// REQ-2026-023：原生登录代理的 clientId（值形同 = lab-management oauth_client
// code）。与服务账号 clientId 分键（LAB_SAAS_SERVICE_CLIENT_ID），各自 fail-fast。
const NATIVE_CLIENT_ID = () => requireEnv("LAB_SAAS_CLIENT_ID");

/** saas /api/v1/auth/login 密码登录（服务账号用），返回 accessToken。失败返回 null（调用方 warn 兜底）。
 *  2026-09-04 export：menus route miss 自愈复用本函数（同步阻塞重拉菜单快照）。 */
export async function serviceLogin(): Promise<string | null> {
  try {
    const resp = await fetch(`${SAAS_BASE_URL().replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: SERVICE_USER(),
        password: SERVICE_PASSWORD(),
        clientId: SERVICE_CLIENT_ID(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.warn(`[login] saas service login ${resp.status}`);
      return null;
    }
    const body = (await resp.json()) as { accessToken?: string };
    return body.accessToken ?? null;
  } catch (err) {
    console.warn(`[login] saas service login failed: ${(err as Error).message}`);
    return null;
  }
}

// === REQ-2026-023：原生登录代理（用户账密校验委托 saas IdP） ===

type SaasLoginUser = {
  id?: string;
  username?: string;
  email?: string;
  displayName?: string;
  status?: string;
};
type SaasAvailableTenant = { tenantId?: string; roleIds?: string[]; status?: string };
type SaasLoginBody = {
  user?: SaasLoginUser;
  availableTenants?: SaasAvailableTenant[];
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  currentTenantId?: string;
};

type ProxyResult =
  { kind: "ok"; body: SaasLoginBody } | { kind: "invalid" } | { kind: "unavailable" };

/** 用请求体账密调 saas 密码登录（clientId=LAB_SAAS_CLIENT_ID）。错误归类五仓统一：
 *  saas 4xx → invalid；5xx/网络异常/超时 → unavailable。 */
async function proxySaasLogin(username: string, password: string): Promise<ProxyResult> {
  try {
    const resp = await fetch(`${SAAS_BASE_URL().replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, clientId: NATIVE_CLIENT_ID() }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.status >= 400 && resp.status < 500) return { kind: "invalid" };
    if (!resp.ok) return { kind: "unavailable" };
    const body = (await resp.json().catch(() => ({}))) as SaasLoginBody;
    return { kind: "ok", body };
  } catch (err) {
    console.warn(`[login] saas proxy login failed: ${(err as Error).message}`);
    return { kind: "unavailable" };
  }
}

/** 趁持有 saas accessToken 的瞬时窗口拉平台租户列表建 tenantId→{name, key} 映射
 *  （与 sso/callback 同款 best-effort：失败只 warn，降级 name=tenantId）。 */
async function fetchTenantNames(
  accessToken: string | undefined,
): Promise<Map<string, { name: string; key: string }>> {
  const empty = new Map<string, { name: string; key: string }>();
  if (!accessToken) return empty;
  try {
    const res = await fetch(
      `${SAAS_BASE_URL().replace(/\/$/, "")}/api/v1/admin/tenants?page=0&pageSize=100`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      console.warn(`[login] tenant name lookup HTTP ${res.status}`);
      return empty;
    }
    const data = (await res.json().catch(() => ({}))) as {
      items?: Array<{ id?: string; name?: string; tenantKey?: string }>;
    };
    return new Map(
      (data.items ?? [])
        .filter((t): t is { id: string; name?: string; tenantKey?: string } => !!t.id)
        .map((t) => [t.id, { name: t.name ?? t.id, key: t.tenantKey ?? t.id }]),
    );
  } catch (err) {
    console.warn(`[login] tenant name lookup failed: ${(err as Error).message}`);
    return empty;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "username and password are required" },
      { status: 400 },
    );
  }
  // ADR-0019 + P2 debt: LabJwtSigner 走真 HS256（与 msw/aspnetcore/springboot 形态对齐）,
  // 缺失即 throw;不允许 mock-jwt opaque token 兜底。
  const labCfg = readLabConfig();
  const signer = new LabJwtSigner(
    labCfg.jwt.secret,
    labCfg.jwt.issuer,
    labCfg.jwt.ttlSeconds,
    labCfg.jwt.refreshTtlSeconds,
  );

  // REQ-2026-023：账密校验委托 saas IdP（本地 dev 目录路径已退役）。
  const proxy = await proxySaasLogin(username, password);
  if (proxy.kind === "invalid") {
    return NextResponse.json(
      { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      { status: 401 },
    );
  }
  if (proxy.kind === "unavailable") {
    return NextResponse.json(
      { code: "SAAS_UNAVAILABLE", message: "saas IdP unavailable" },
      { status: 502 },
    );
  }
  const saasLogin = proxy.body;

  // 映射复用 sso/callback 富化链：availableTenants 无租户名 → admin/tenants
  // best-effort 填真名，失败降级 code/name=tenantId（整体仍 200）。
  // 2026-10-20 租户标识=tenant_key（人裁「对外交互用 key」）：命中租户
  // tenantId=code=tenantKey；miss 降级原 tenantId。
  const nameById = await fetchTenantNames(saasLogin.accessToken);
  const tenants = (saasLogin.availableTenants ?? [])
    .filter(
      (t): t is SaasAvailableTenant & { tenantId: string } =>
        !!t.tenantId && t.status !== "removed",
    )
    .map((t) => {
      const tid = nameById.get(t.tenantId)?.key ?? t.tenantId;
      return {
        tenantId: tid,
        code: tid,
        name: nameById.get(t.tenantId)?.name ?? t.tenantId,
        roleIds: t.roleIds ?? [],
      };
    });
  // 2026-10-20 tenant_key 人裁：会话 tenant_id claim 同走 key 解析（currentTenantId
  // 是 saas 原始 id → 平台列表命中换 key，miss 降级原值）
  const currentTenantId = saasLogin.currentTenantId
    ? (nameById.get(saasLogin.currentTenantId)?.key ?? saasLogin.currentTenantId)
    : null;
  // 回退链用 ||（记忆陷阱：saas user 无 displayName 且空串 falsy，?? 拦不住）。
  const saasUser = saasLogin.user ?? {};
  const user = {
    id: saasUser.id || saasLogin.userId || "unknown",
    username: saasUser.username || saasUser.email || "unknown",
    displayName:
      saasUser.displayName || saasUser.username || saasUser.email || "未知用户",
    roleCode: tenants[0]?.roleIds?.[0] || "member",
  };

  // 菜单快照仍走服务账号 serviceLogin（REQ-2026-023 非目标：行为不动）。
  // saas 不可达也写**空快照**——GET /menus 200 [] 而非 503，契约面不分叉。
  const saasToken = await serviceLogin();
  if (saasToken) {
    await cacheMenuSnapshot(user.id, saasToken, SAAS_BASE_URL());
  } else {
    putMenuSnapshot(user.id, []);
  }
  // membership-snapshot 同步写（与响应 tenants 同源同形，/api/auth/me 按同 key 读取，
  // hydrateAuth 的 find 必命中）——与 sso/callback 同语义，数据源换成 saas 真实租户。
  putMembershipSnapshot(user.id, tenants);
  // 2026-10-21 ADR-0019 收口：user 快照同步写（/api/auth/me 与 switch-tenant 按
  // 同 key 读，镜像 rails resolve_user）——me/switch 不再有 DEMO_USER 字面量兜底。
  putUserSnapshot(user.id, user);
  return NextResponse.json({
    // lab 自家 JWT 重签（REQ-2026-023 Q3 人裁：不透传 saas token）；tenantId 取
    // saas currentTenantId，缺省落首租户。
    token: signer.issue(user.id, currentTenantId ?? tenants[0]?.tenantId ?? null),
    // refresh 维持 dev-placeholder 机制（REQ-2026-023 非目标：refresh 代理化留后续）。
    refreshToken: signer.issueRefresh(user.id, "dev-refresh-token-placeholder"),
    user,
    tenants,
  });
}
