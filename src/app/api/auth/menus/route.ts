// GET /api/auth/menus -> 菜单树（ADR-0009：saas 快照缓存 -> miss 503）
//
// 数据链（与 lab-springboot 同款语义，2026-08-27 起 demo 兜底删除）：
//   1. SSO callback / 密码登录时拉 saas /api/v1/me/menus 存快照
//      （lib/auth/menu-snapshot.ts，TTL 30min，key = saas userId）
//   2. 本端点从 Authorization: Bearer <saas accessToken> 解出 sub（JWT payload），
//      读快照命中即返回
//   3. miss（快照过期/拉取失败/重启/无 token）-> 503 MENUS_UNAVAILABLE，
//      不再返回假树；前端 useBackendMenus 失败回退静态菜单
//
// 本仓 token 即 saas accessToken（sso/callback 原样透传，见其注释 §3），
// sub 为 saas user id - 与快照 key 一致，无需再查 /me。

import { NextResponse } from "next/server";
import { getMenuSnapshot } from "@/lib/auth/menu-snapshot";

/** 从 Authorization: Bearer <jwt> 解 JWT payload sub（不验签 - 本仓 demo 路由
 *  均不校验 JWT；快照 key 是 sub，伪造 sub 只能拿到别人的菜单快照，demo 阶段可接受）。 */
function subFromBearer(authz: string | null): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const sub = subFromBearer(request.headers.get("authorization"));
  const snapshot = getMenuSnapshot(sub);
  if (!snapshot) {
    // demo 兜底删除（2026-08-27）：miss 如实报错，可恢复态（重登/refresh 重建快照）
    return NextResponse.json(
      {
        code: "MENUS_UNAVAILABLE",
        message: `menu snapshot unavailable for user ${sub ?? "(anonymous)"}; re-login to refresh`,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(snapshot);
}
