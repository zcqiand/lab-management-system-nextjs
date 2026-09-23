// /api CORS 白名单中间件（2026-09-22 治本；2026-09-22 P3 波1 全量回归 41 红同根因）。
//
// 家族背景：lab-springboot 有 SecurityConfig.corsConfigurationSource（LAB_CORS_ALLOWED_ORIGINS
// CSV + allowCredentials=true），本仓一直没有对应物。2026-09-17 msw 剔除后
// react(:5202)/vue(:5203) 默认后端切到本仓，跨源 XHR 服务器 200 但浏览器
// net::ERR_FAILED 200（无 ACAO 头被拦）。本中间件对齐 springboot 语义：
//
//   - LAB_CORS_ALLOWED_ORIGINS：CSV 白名单（trim 容错）
//   - origin 在白名单 → 响应补 ACAO（回显 origin，非 *——credentials 模式禁 *）+ Vary: Origin
//   - origin 不在白名单 → fail closed：预检 403（Spring DefaultCorsProcessor 同语义），
//     实际请求不补头（浏览器侧拦）
//   - 无 Origin 头（同源 / 服务端调用）→ 原样放行
//   - ADR-0019：env 缺失 requireEnv throw（fail-fast），不静默退化成「空白名单 = 全禁」
//
// 惰性求值（函数体内读 env）：顶层 requireEnv 会让 next build 的 Docker builder
// 阶段崩（同 api/auth/sso/authorize/route.ts 注释）。

import { NextResponse, type NextRequest } from "next/server";

import { requireEnv } from "@/lib/env-required";

// 预检允许的方法（镜像 springboot SecurityConfig allowedMethods）
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function parseWhitelist(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPreflight(request: NextRequest): boolean {
  return (
    request.method === "OPTIONS" && request.headers.has("access-control-request-method")
  );
}

export function middleware(request: NextRequest): NextResponse {
  const whitelist = parseWhitelist(requireEnv("LAB_CORS_ALLOWED_ORIGINS"));
  const origin = request.headers.get("origin");

  // 同源 / 服务端调用：无 Origin，无需 CORS，原样放行
  if (!origin) {
    return NextResponse.next();
  }

  if (!whitelist.includes(origin)) {
    // fail closed：预检直接拒绝；实际请求不补头，由浏览器拦截
    if (isPreflight(request)) {
      return new NextResponse(null, { status: 403 });
    }
    return NextResponse.next();
  }

  if (isPreflight(request)) {
    const requestHeaders = request.headers.get("access-control-request-headers");
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": ALLOWED_METHODS,
        // 回显预检声明的请求头（无声明则不带，浏览器按简单头放行）
        ...(requestHeaders ? { "Access-Control-Allow-Headers": requestHeaders } : {}),
        "Access-Control-Max-Age": "86400",
        Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
