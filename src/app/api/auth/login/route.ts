// POST /api/auth/login
//
// 2026-09-04 (ADR-0019 配套 + P2 debt 清): demo 模式(login 默认 no-sso profile)也走真
// HS256 token 签发（LabJwtSigner），不再用 mock-jwt-${username} opaque token。
// 与 msw/aspnetcore/springboot 真后端 token 形态对齐 → contract-test 4-way 一致。
//
// 2026-08-27 菜单快照配套（demo 兜底删除）：密码登录用户无 saas 身份，
// login 成功后用服务账号（LAB_SAAS_SERVICE_USER/PASSWORD，dev 默认
// alice/dev123456）登 saas /api/v1/auth/login 换 token，再拉 /me/menus
// 存快照（key = lab userId）。失败只 warn 不抛 -- 登录主流程不受影响，
// miss 时 GET /menus 503 由前端 useBackendMenus 回退静态菜单。

import { NextResponse } from "next/server";
import { cacheMenuSnapshot, putMenuSnapshot } from "@/lib/auth/menu-snapshot";
import { putMembershipSnapshot } from "@/lib/auth/membership-snapshot";
import { ConfigUserDirectory } from "@/lib/auth/directory";
import { requireEnv } from "@/lib/env-required";
import { LabJwtSigner } from "@/lib/auth/jwt";
import { readLabConfig } from "@/lib/auth/factory";

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "third-party", name: "第三方检测实验室", roleIds: ["viewer"] },
];

// v0.3.56:SAAS_BASE_URL 是 Phase 4 对称化已删的死 key(deploy 脚本 L115 迁移删掉,
// 线上一直吃 localhost fallback 打容器内 3000,菜单快照静默 warn 失败)。
// 真名 SAAS_IDP_URL,与 sso/authorize 路由一致。
//
// ADR-0019：所有服务账号凭据 (idp url / service_user / service_password / dev_password)
// 缺失即 throw（由 requireEnv 抛 500）。不允许 fallback 到 alice/dev123456 字面值。
// ADR-0019：所有服务账号凭据 (idp url / service_user / service_password / dev_password)
// 缺失即 throw（由 requireEnv 抛 500）。不允许 fallback 到 alice/dev123456 字面值。
//
// 惰性求值（不在模块顶层调 requireEnv）：next build 的 "Collecting page data"
// 会 import 本模块，顶层求值等于要求 build 环境备齐 prod 凭据。Docker builder
// stage 没有（.env.production gitignored，不在 build context），build 直接崩。
// 放进函数体后 build 不求值，运行时缺失仍立即 throw → 500，fail-fast 语义不变。
const SAAS_BASE_URL = () => requireEnv("SAAS_IDP_URL");
const SERVICE_USER = () => requireEnv("LAB_SAAS_SERVICE_USER");
const SERVICE_PASSWORD = () => requireEnv("LAB_SAAS_SERVICE_PASSWORD");

/** saas /api/v1/auth/login 密码登录（服务账号用），返回 accessToken。失败返回 null（调用方 warn 兜底）。
 *  2026-09-04 export：menus route miss 自愈复用本函数（同步阻塞重拉菜单快照）。 */
export async function serviceLogin(): Promise<string | null> {
  try {
    const resp = await fetch(`${SAAS_BASE_URL().replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: SERVICE_USER(), password: SERVICE_PASSWORD() }),
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
  // 2026-09-02 契约对齐：走 directory 校验（alice/dev123456，与 msw/springboot/aspnetcore
  // 四方一致；错凭证 401 不再 demo 放行——contract-test 错误分支比对依赖）。
  // ADR-0019：dev_password 缺失 throw,不允许 fallback 到字面 "dev123456"。
  const directory = new ConfigUserDirectory(
    requireEnv("LAB_AUTH_DEV_PASSWORD"),
  );
  // ADR-0019 + P2 debt: LabJwtSigner 走真 HS256（与 msw/aspnetcore/springboot 形态对齐）,
  // 缺失即 throw;不允许 mock-jwt opaque token 兜底。
  const labCfg = readLabConfig();
  const signer = new LabJwtSigner(
    labCfg.jwt.secret,
    labCfg.jwt.issuer,
    labCfg.jwt.ttlSeconds,
    labCfg.jwt.refreshTtlSeconds,
  );
  if (!directory.checkPassword(username, password)) {
    return NextResponse.json(
      { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      { status: 401 },
    );
  }
  const user = directory.findByUsername(username)!;
  // 密码登录用户无 saas 身份 -> 服务账号拉菜单快照（失败只 warn，不阻塞登录）。
  // 2026-09-02 契约对齐：saas 不可达（no-sso）也写**空快照**——与 msw/springboot/aspnetcore
  // noop 语义一致（login 写空快照 → GET /menus 200 [] 而非 503），四方契约面不分叉。
  const saasToken = await serviceLogin();
  if (saasToken) {
    await cacheMenuSnapshot(user.id, saasToken, SAAS_BASE_URL());
  } else {
    putMenuSnapshot(user.id, []);
  }
  // no-sso demo 模式也写真 JWT 形态（与 msw/aspnetcore/springboot 对齐 → contract-test 4-way 一致）。
  // membership-snapshot 同步写,让 /api/auth/me 走 snapshot hit 路径而非 401 miss。
  // 这与 sso/callback 写 saas 真实 memberships 同语义,只是数据来自 DEMO_TENANTS。
  putMembershipSnapshot(
    user.id,
    DEMO_TENANTS.map((t) => ({
      tenantId: t.tenantId,
      code: t.code,
      name: t.name,
      roleIds: t.roleIds,
    })),
  );
  return NextResponse.json({
    // ADR-0019 + P2 debt：demo 模式也走真 HS256（LabJwtSigner），与 3 真后端 token 形态对齐。
    // contract-test 4-way 比对要求 token 是真 JWT（3 段 base64url），msw/aspnetcore/springboot 已发真 token,
    // lab-nextjs 之前发 mock-jwt-${username} opaque 字符串,4-way normalize 必失败。
    // tenantId 选 TENANT-001 与 msw 仓 currentTenantId 行为一致。
    token: signer.issue(user.id, "TENANT-001"),
    refreshToken: signer.issueRefresh(user.id, "dev-refresh-token-placeholder"),
    user,
    tenants: DEMO_TENANTS,
  });
}
