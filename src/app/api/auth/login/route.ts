// POST /api/auth/login
// Demo: any non-empty user/password returns mock token + DEMO_USER.
// Real path (future): pg.Client -> lab_dev.users 表校验 + 签 JWT。
//
// 2026-08-27 菜单快照配套（demo 兜底删除）：密码登录用户无 saas 身份，
// login 成功后用服务账号（LAB_SAAS_SERVICE_USER/PASSWORD，dev 默认
// alice/dev123456）登 saas /api/v1/auth/login 换 token，再拉 /me/menus
// 存快照（key = lab userId）。失败只 warn 不抛 -- 登录主流程不受影响，
// miss 时 GET /menus 503 由前端 useBackendMenus 回退静态菜单。

import { NextResponse } from "next/server";
import { cacheMenuSnapshot } from "@/lib/auth/menu-snapshot";

const DEMO_TENANTS = [
  { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
  { tenantId: "TENANT-002", code: "district-lab", name: "区检测站", roleIds: ["technician"] },
  { tenantId: "TENANT-003", code: "第三方检测实验室", roleIds: ["viewer"] },
];

const SAAS_BASE_URL = process.env.SAAS_BASE_URL ?? "http://localhost:3000";
const SERVICE_USER = process.env.LAB_SAAS_SERVICE_USER ?? "alice";
const SERVICE_PASSWORD = process.env.LAB_SAAS_SERVICE_PASSWORD ?? "dev123456";

/** saas /api/v1/auth/login 密码登录（服务账号用），返回 accessToken。失败返回 null（调用方 warn 兜底）。 */
async function serviceLogin(): Promise<string | null> {
  try {
    const resp = await fetch(`${SAAS_BASE_URL.replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: SERVICE_USER, password: SERVICE_PASSWORD }),
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
  // 密码登录用户无 saas 身份 -> 服务账号拉菜单快照（失败只 warn，不阻塞登录）
  const saasToken = await serviceLogin();
  if (saasToken) {
    await cacheMenuSnapshot("USER-A", saasToken, SAAS_BASE_URL);
  }
  return NextResponse.json({
    token: `mock-jwt-${username}`,
    refreshToken: `mock-refresh-${username}`,
    user: { id: "USER-A", username, displayName: username, roleCode: "admin" },
    tenants: DEMO_TENANTS,
  });
}
