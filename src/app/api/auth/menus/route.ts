// @entry M01.F04.I01 — 动态菜单下发（GET /api/auth/menus）
// GET /api/auth/menus -> 菜单树（ADR-0009：saas 快照缓存 -> miss 503）
//
// 数据链（与 lab-springboot 同款语义，2026-08-27 起 demo 兜底删除）：
//   1. SSO callback / 密码登录时拉 saas /api/v1/me/menus 存快照
//      （lib/auth/menu-snapshot.ts，TTL 30min，key = saas userId）
//   2. 本端点从 Authorization: Bearer <saas accessToken> 解出 sub（JWT payload），
//      读快照命中即返回
//   3. miss（快照过期/拉取失败/重启/无 token）-> 同步 serviceLogin + cacheMenuSnapshot
//      重拉重建快照：拉到（含空树）→ 200；saas 不可达 / 登录失败 → 503（既有错误语义不变）
//      前端 useBackendMenus 失败回退静态菜单
//
// 本仓 token 即 saas accessToken（sso/callback 原样透传，见其注释 §3），
// sub 为 saas user id - 与快照 key 一致，无需再查 /me。

import { NextResponse } from "next/server";
import { cacheMenuSnapshot, getMenuSnapshot } from "@/lib/auth/menu-snapshot";
import { serviceLogin } from "@/app/api/auth/login/route";
import { requireEnv } from "@/lib/env-required";
import { subFromBearer } from "@/lib/auth/bearer";

// 2026-09-04 与 login route 同款 SAAS_BASE_URL 取值（Phase 4 对称化真名 SAAS_IDP_URL）。
// 必须与 login/route.ts 一致，否则两边漂移。
//
// ADR-0019：SAAS_IDP_URL 缺失 throw,不允许 fallback 到 localhost。
// 惰性求值：顶层调 requireEnv 会让 next build 的 "Collecting page data" 崩
// （Docker builder stage 没有 prod env）。运行时缺失仍 throw → 500。
const SAAS_BASE_URL = () => requireEnv("SAAS_IDP_URL");

export async function GET(request: Request) {
  const sub = subFromBearer(request.headers.get("authorization"));
  if (sub === null) {
    // ADR-0019：无 Bearer = 401，不再 fallback "USER-A" 走 demo 路径。
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
      { status: 401 },
    );
  }
  const snapshot = getMenuSnapshot(sub);
  if (!snapshot) {
    // 2026-09-04 自愈：部署重启后快照清空，浏览器持旧 token 用户刷新会撞 miss。
    // 对齐 login route serviceLogin 链同步重拉；拉到（含空树）→ 200；拉不到 → 503。
    const saasToken = await serviceLogin();
    if (saasToken) {
      await cacheMenuSnapshot(sub, saasToken, SAAS_BASE_URL());
      const recovered = getMenuSnapshot(sub);
      if (recovered) return NextResponse.json(recovered);
    } else {
      console.warn(`[menus] self-heal: service-account login unreachable for user ${sub}`);
    }
    // demo 兜底删除（2026-08-27）：miss 如实报错，可恢复态（重登/refresh 重建快照）
    return NextResponse.json(
      {
        code: "MENUS_UNAVAILABLE",
        message: `menu snapshot unavailable for user ${sub}; re-login to refresh`,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(snapshot);
}
