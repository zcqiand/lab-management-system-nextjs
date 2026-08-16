// GET /api/saas/app?appCode=<code> -> saas /api/v1/apps/<code>
//
// 反代目的与 /api/saas/me/menus 相同：浏览器直连 saas 会撞 CORS，本路由服务端
// fetch 转发。返回 saas AppPublicInfo（id/code/name/description/icon/status），
// 供侧边栏/顶栏显示 saas 注册的应用名（不写死在客户端）。
// saas 端此端点免鉴权（公共应用目录）。

import { NextResponse } from "next/server";

const SAAS_BASE_URL =
  process.env.SAAS_BASE_URL ??
  process.env.NEXT_PUBLIC_SAAS_BASE_URL ??
  "http://localhost:3000";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appCode = url.searchParams.get("appCode");
  if (!appCode) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: "appCode query parameter is required",
      },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(
      `${SAAS_BASE_URL}/api/v1/apps/${encodeURIComponent(appCode)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!upstream.ok) {
      return NextResponse.json(
        {
          code: "SAAS_UPSTREAM_ERROR",
          message: `saas 返回 ${upstream.status}`,
        },
        { status: 502 },
      );
    }
    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        code: "SAAS_UNREACHABLE",
        message: (err as Error).message,
      },
      { status: 502 },
    );
  }
}
