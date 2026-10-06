// CORS middleware for /api/* — consume LAB_CORS_ALLOWED_ORIGINS
//
// Why this exists:
//   lab-nextjs 的 /api/* 是「跨仓 lab-flutter (web dev :5208) 浏览器」的消费方
//   （同仓 5201 页面为同源，不依赖 CORS）。浏览器跨域请求会撞 CORS；
//   这里把允许的 origin 白名单读出来挂响应头，flutter 页面拿到 Allow-Origin
//   后才能读响应。2026-10-06 补：家族 saas-nextjs src/middleware.ts 同构缺失
//   （此前 .env 注释所指「治本」只落了值表，运行时消费点从未接线，
//   REQ-2026-002 联调阻塞指纹：预检 204 但无 Access-Control-Allow-Origin）。
//
// 配置来源：
//   .env.example:65  LAB_CORS_ALLOWED_ORIGINS=http://localhost:5201,...  （逗号分隔 origin 列表）
//   镜像 springboot LAB_CORS_ALLOWED_ORIGINS / aspnetcore Lab.Cors.AllowedOrigins，
//   SSOT 命名不另起。
//
// 行为：
//   - 命中 allowlist 的 origin：响应注入 Access-Control-Allow-Origin + Vary: Origin +
//     Access-Control-Allow-Credentials + Allow-Methods / Allow-Headers；OPTIONS 直接 204。
//   - 没命中 allowlist：不挂 CORS 头，浏览器层会被拦（即使到达路由处理器也读不到响应）。
//   - 空 env / 没配：默认 fail-safe —— 任何 origin 都不放行（开发期要补 .env）。
//   - 不挂 Access-Control-Allow-Origin: * —— 因为要支持 credential + Authorization header，
//     spec 要求 origin 必须回显具体值。
//
// 与 saas 同构差异：matcher 为 /api/:path*（lab 路由无 /v1 段；flutter 无服务端，
// /api/auth/* 与业务面一样由浏览器直调，不存在「auth 子路径排除」语义）。
//
// Next.js 15 middleware 跑在 Edge runtime；这里只读 env + 拼 header，不 import @/db 等
// 会在模块顶层 throw 的模块。

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HEADERS = "Authorization, Content-Type";
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const MAX_AGE_SECONDS = "86400";

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.LAB_CORS_ALLOWED_ORIGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = parseAllowedOrigins();
  const originAllowed = !!origin && allowed.has(origin);

  // 预检 OPTIONS：命中就 204 + 全套 CORS 头；不命中也返 204 但不挂 Allow-Origin
  // （让浏览器自己拦，请求不会到路由处理器；Next.js 不会自动 OPTIONS App Router 路由）
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (originAllowed && origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.headers.set("Access-Control-Max-Age", MAX_AGE_SECONDS);
    }
    return res;
  }

  // 实际请求：放行到路由处理器，响应再加 CORS 头（next() 之后再 set 不会冲突）
  const res = NextResponse.next();
  if (originAllowed && origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Expose-Headers", ALLOWED_HEADERS);
  }
  return res;
}

export const config = {
  // 仅拦截 /api/*；其他路径（页面）不走 CORS middleware。
  matcher: ["/api/:path*"],
};
