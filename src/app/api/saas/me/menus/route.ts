// GET /api/saas/me/menus?appCode=<code> → saas /api/v1/me/menus?appCode=<code>
//
// 反代目的：lab-nextjs 浏览器直接 GET saas:3000/api/v1/me/menus 会撞 CORS
// （saas 没返 Access-Control-Allow-Origin）。本路由服务端 fetch，转发响应。
//
// 只接 ?appCode= 一种入参（不透传全量菜单）；返回 menus[]（不带 appCode 嵌套）。
// msw 模式下 saas-msw /me/menus 不校验 Authorization，返 menus 给「acme admin」。

import { NextResponse } from "next/server";

const SAAS_BASE_URL = process.env.SAAS_BASE_URL ?? "http://localhost:3000";

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
      `${SAAS_BASE_URL}/api/v1/me/menus?appCode=${encodeURIComponent(appCode)}`,
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
