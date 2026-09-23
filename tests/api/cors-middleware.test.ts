// src/middleware.ts CORS 白名单语义回归（镜像 lab-springboot SecurityConfig.corsConfigurationSource）。
//
// 背景（2026-09-22 P3 波1 全量回归 41 红同根因）：lab-nextjs 是家族里唯一没有
// CORS 层的后端，2026-09-17 msw 剔除后 react(:5202)/vue(:5203) 默认后端切到本仓，
// 跨源 XHR 全被浏览器拦。指纹：服务器侧 200 OK 但浏览器 net::ERR_FAILED 200，
// console 报「No 'Access-Control-Allow-Origin' header is present」。
//
// 契约（镜像 springboot SecurityConfig + DefaultCorsProcessor）：
//   - LAB_CORS_ALLOWED_ORIGINS = CSV 白名单（trim 容错），allowCredentials=true
//   - origin 在白名单 → 响应补 ACAO（回显 origin，非 *——credentials 模式禁止 *）+ Vary: Origin
//   - origin 不在白名单 → 不补 ACAO（fail closed，浏览器拦）；其预检 403
//   - 无 Origin 头（同源/服务端调用）→ 原样放行不加 CORS 头
//   - env 缺失 → requireEnv throw（ADR-0019 fail-fast，不静默退化成全禁）
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeReq(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(`http://localhost:5201${url}`, {
    method: init.method ?? "GET",
    headers: init.headers ?? {},
  });
}

describe("src/middleware CORS 白名单（LAB_CORS_ALLOWED_ORIGINS）", () => {
  beforeEach(() => {
    vi.stubEnv(
      "LAB_CORS_ALLOWED_ORIGINS",
      "http://localhost:5202, http://localhost:5203",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("白名单 origin 的 GET：回显 ACAO + allowCredentials + Vary Origin", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      makeReq("/api/auth/sso/authorize?response_type=code&state=s1", {
        headers: { origin: "http://localhost:5202" },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5202");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("CSV 值带空格仍解析（trim 容错）", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      makeReq("/api/contracts", { headers: { origin: "http://localhost:5203" } }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5203");
  });

  it("非白名单 origin：不补 ACAO（fail closed，浏览器侧拦截）", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      makeReq("/api/contracts", { headers: { origin: "http://evil.example" } }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("无 Origin 头（同源/服务端调用）：原样放行不加 CORS 头", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(makeReq("/api/contracts"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("白名单 origin 的 OPTIONS 预检：204 + 方法白名单 + 请求头回显 + Max-Age", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      makeReq("/api/auth/sso/callback", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5202",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5202");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("content-type");
    expect(res.headers.get("Access-Control-Max-Age")).toBeTruthy();
  });

  it("非白名单 origin 的预检：403（镜像 Spring DefaultCorsProcessor 拒绝语义）", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      makeReq("/api/contracts", {
        method: "OPTIONS",
        headers: {
          origin: "http://evil.example",
          "access-control-request-method": "POST",
        },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("LAB_CORS_ALLOWED_ORIGINS 缺失即 throw（ADR-0019 fail-fast，不静默全禁）", async () => {
    vi.unstubAllEnvs();
    delete process.env.LAB_CORS_ALLOWED_ORIGINS;
    const { middleware } = await import("@/middleware");
    expect(() =>
      middleware(
        makeReq("/api/contracts", {
          headers: { origin: "http://localhost:5202" },
        }),
      ),
    ).toThrow(/LAB_CORS_ALLOWED_ORIGINS/);
  });

  it("config.matcher 只挂 /api 路由（页面/静态资源不进中间件）", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toEqual(["/api/:path*"]);
  });
});
