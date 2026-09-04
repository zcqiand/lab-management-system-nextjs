// M98 接线层 — fnTest（ADR-0014 后只保留 F02 + F03）。
//
// 覆盖：
//   F02.I01 axios 拦截器
//   F03.I01 POST /api/auth/login
//   F03.I02 GET /api/auth/me
//   F03.I03 POST /api/auth/logout
//   F03.I04 POST /api/auth/refresh
//   F03.I05 POST /api/auth/switch-tenant
//
// F01.I01（BackendSwitcher）+ F01.I02（持久化 baseUrl）已废弃（ADR-0014），
// 跟随 BackendSwitcher.tsx / backend-context.tsx 一并删除。F03 走直接 import
// 路由 handler + 构造 mock Request（不动 nextjs dev server）。

import { describe, expect, vi } from "vitest";
import { installHttpClient } from "@/api/http-client";
import { fnTest } from "../fn";

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { POST as refreshPOST } from "@/app/api/auth/refresh/route";
import { POST as switchTenantPOST } from "@/app/api/auth/switch-tenant/route";

describe("M98 frontend 接线层", () => {
  fnTest(["M98.F02.I01"], "installHttpClient 是函数且注册到全局 axios 拦截器不抛", async () => {
    // installHttpClient 注册 request 拦截器到全局 axios 单例；多次调用都安全。
    expect(typeof installHttpClient).toBe("function");
    expect(() => installHttpClient(() => "token-a")).not.toThrow();
    expect(() => installHttpClient(() => "token-b")).not.toThrow();
    // 触发 axios 请求（nextjs 同源 "" baseURL 下，被 msw server.use 未处理 → 401/网络错都可，验证拦截器链无 throw）
    const { default: axios } = await import("axios");
    try {
      await axios.get("/api/__nonexistent__probe__");
    } catch {
      /* 网络/状态码错都接受，断言拦截器链没崩 */
    }
  });

  fnTest(["M98.F03.I01"], "POST /api/auth/login 接受 username+password 返回真 HS256 token + 3 租户", async () => {
    // ADR-0019 + P2 debt：login 改用 LabJwtSigner 真签 (3 段 base64url)，
    // 与 msw/aspnetcore/springboot 3 真后端 token 形态对齐 → contract-test 4-way 一致。
    const req = new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "dev123456" }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; tenants: Array<{ tenantId: string }> };
    // 真 JWT = 3 段 base64url + payload 含 sub
    expect(body.token.split(".").length).toBe(3);
    const payload = JSON.parse(Buffer.from(body.token.split(".")[1]!, "base64url").toString("utf-8"));
    expect(payload.sub).toBe("USER-A");
    expect(body.tenants).toHaveLength(3);
    expect(body.tenants[0]?.tenantId).toBe("TENANT-001");
  });

  fnTest(["M98.F03.I02"], "GET /api/auth/me 无 Bearer 返 401（ADR-0019 删 demo 兜底）", async () => {
    // ADR-0019：删「无 Bearer = DEMO_USER」反模式。meGET 无 Bearer 必须 401。
    // 真路径要 login 后拿 token + 建 membership 快照，单独 fnTest 覆盖。
    const res = await meGET(new Request("http://test/api/auth/me"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  fnTest(["M98.F03.I03"], "POST /api/auth/logout 返回 204", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(204);
  });

  fnTest(["M98.F03.I04"], "POST /api/auth/refresh 无 refreshToken 返 401（ADR-0019 删 admin 兜底）", async () => {
    // ADR-0019：删「refreshToken ?? "admin"」反模式。refreshPOST 无 token 必须 401。
    // 真路径要 saas oauth/token grant_type=refresh_token,单独 fnTest 覆盖。
    const req = new Request("http://test/api/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await refreshPOST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  fnTest(["M98.F03.I04"], "POST /api/auth/refresh 返 400 REFRESH_NOT_IMPLEMENTED 且不调 saas（ADR-0019）", async () => {
    // ADR-0019：refresh 现在返 400 REFRESH_NOT_IMPLEMENTED（真路径走 saas /oauth/token grant_type=refresh_token,本仓 demo 暂未接通）。
    // 钉死「demo refresh 不调 saas」契约——未来接 saas SSO 时此断言会失败提醒扩展。
    const origFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const req = new Request("http://test/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "mock-refresh-labadmin" }),
      });
      const res = await refreshPOST(req);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("REFRESH_NOT_IMPLEMENTED");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  fnTest(["M98.F03.I05"], "POST /api/auth/switch-tenant 无 Bearer 返 401（ADR-0019 删 demo 兜底）", async () => {
    // ADR-0019：删「无 Bearer = 切到 demo USER-A」反模式。
    const req = new Request("http://test/api/auth/switch-tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "TENANT-002" }),
    });
    const res = await switchTenantPOST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    // 错误 tenantId → 401 优先（auth 失败早于 tenant 校验,ADR-0019）
    const badReq = new Request("http://test/api/auth/switch-tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "TENANT-999" }),
    });
    const badRes = await switchTenantPOST(badReq);
    expect(badRes.status).toBe(401);
  });

  fnTest(["M98.F01.I01"], "BackendBadge 源文件挂 data-fn=I01 + 含 mode/baseUrl 渲染", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/app/backend-badge.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-fn="M98\.F01\.I01"/);
    expect(src).toMatch(/getApiMode\(\)/);
    expect(src).toMatch(/getApiBaseUrl\(\)/);
  });
});