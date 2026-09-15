// 前端接线层单测（ADR-0033 阶段二：M98 infra 段自 function-tree 退役，
// fnTest 锚点解挂为普通 it —— 路由 handler / 拦截器仍是本仓自有实现，照常测试）。
//
// 覆盖：axios 拦截器 + /api/auth/{login,me,logout,refresh,switch-tenant} 5 路由。
// 走直接 import 路由 handler + 构造 mock Request（不动 nextjs dev server）。

import { describe, it, expect, vi } from "vitest";
import { installHttpClient } from "@/api/http-client";

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { POST as refreshPOST } from "@/app/api/auth/refresh/route";
import { POST as switchTenantPOST } from "@/app/api/auth/switch-tenant/route";

describe("M98 frontend 接线层", () => {
  it("installHttpClient 是函数且注册到全局 axios 拦截器不抛", async () => {
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

  it("POST /api/auth/login 接受 username+password 返回真 HS256 token + 3 租户", async () => {
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

  it("GET /api/auth/me 无 Bearer 返 401（ADR-0019 删 demo 兜底）", async () => {
    // ADR-0019：删「无 Bearer = DEMO_USER」反模式。meGET 无 Bearer 必须 401。
    // 真路径要 login 后拿 token + 建 membership 快照，me-route.dom.test.tsx 覆盖。
    const res = await meGET(new Request("http://test/api/auth/me"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/logout 返回 204", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(204);
  });

  it("POST /api/auth/refresh 无 refreshToken 返 401（ADR-0019 删 admin 兜底）", async () => {
    // ADR-0019：删「refreshToken ?? "admin"」反模式。refreshPOST 无 token 必须 401。
    // 真路径要 saas oauth/token grant_type=refresh_token,本文件下方 400 分支覆盖。
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

  it("POST /api/auth/refresh 返 400 REFRESH_NOT_IMPLEMENTED 且不调 saas（ADR-0019）", async () => {
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

  it("POST /api/auth/switch-tenant 无 Bearer 返 401（ADR-0019 删 demo 兜底）", async () => {
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

  it("POST /api/auth/switch-tenant 有效 Bearer + 租户 → 200 + 真 HS256 JWT（3 段）", async () => {
    // 2026-09-14 对齐 login route：签真 token（LabJwtSigner），不再
    // mock-jwt-tenant-${tid} opaque——那会让 subFromBearer 解不出 sub，切完即 401 断会话。
    const { LabJwtSigner } = await import("@/lib/auth/jwt");
    const signer = new LabJwtSigner(
      "dev-key-32-bytes-minimum-length!",
      "lab-management-system",
      3600,
      604800,
    );
    const req = new Request("http://test/api/auth/switch-tenant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${signer.issue("USER-A", "TENANT-001")}`,
      },
      body: JSON.stringify({ tenantId: "TENANT-002" }),
    });
    const res = await switchTenantPOST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token?: string;
      user?: { id: string };
      tenants?: { tenantId: string }[];
    };
    const parts = (body.token ?? "").split(".");
    expect(parts.length, "token 必须是 3 段 JWT（opaque mock 禁止回归）").toBe(3);
    // 新 token 的 tenant claim 落目标租户（payload 解码断言）
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
      tenant_id?: string;
    };
    expect(payload.sub).toBe("USER-A");
    expect(payload.tenant_id).toBe("TENANT-002");
    expect(body.user?.id).toBe("USER-A");
    expect(body.tenants?.length).toBeGreaterThan(0);
  });

  it("POST /api/auth/switch-tenant 未知租户 → 404", async () => {
    const { LabJwtSigner } = await import("@/lib/auth/jwt");
    const signer = new LabJwtSigner(
      "dev-key-32-bytes-minimum-length!",
      "lab-management-system",
      3600,
      604800,
    );
    const req = new Request("http://test/api/auth/switch-tenant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${signer.issue("USER-A", "TENANT-001")}`,
      },
      body: JSON.stringify({ tenantId: "TENANT-999" }),
    });
    const res = await switchTenantPOST(req);
    expect(res.status).toBe(404);
  });

  it("BackendBadge 源文件含切换语义（DropdownMenu + setSelectedBackend，2026-09-14 恢复运行时切换）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/app/backend-badge.tsx"),
      "utf8",
    );
    expect(src).toMatch(/setSelectedBackend/);
    expect(src).toMatch(/SELECTABLE_BACKENDS/);
    expect(src).toMatch(/DropdownMenu/);
    // 2026-09-15 跨后端 401 修复：真切换必须 clearToken（内存态），
    // setSelectedBackend 层同时清 localStorage 的 lab.token。
    expect(src).toMatch(/clearToken/);
  });
});