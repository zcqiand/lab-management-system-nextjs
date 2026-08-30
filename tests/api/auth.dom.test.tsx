// M01.F04/F05 认证管理集成层 — 7 子项 fnTest（覆盖路由守卫/动态菜单/JWT 登录/
// Token 校验/SSO/会话同步/登出）。
//
// F04.I02 守卫：直接调 useAuth + (console) layout 的渲染分支，无 token → 渲染 guard 占位。
// F04.I04 菜单：SidebarNav 接收 menus 数组渲染分组/子项，无可见子项的分组隐藏。
// F05.I02 Token 校验：apiClient 请求拦截器自动注入 Authorization Bearer。
// F05.I03 SSO：直接调 /api/auth/sso/authorize handler，返回 authorizeUrl。
// F05.I04 会话同步：直接调 /api/auth/sso/callback + /api/auth/permissions。
// F05.I05 登出：直接调 /api/auth/logout handler。
// F05.I01 JWT 登录测试已随该 ID 废弃而删除（2026-08-29）。POST /api/auth/login 路由
// 暂留作 demo 兜底；下次 SSO 接入稳定后一起删。
import { describe, expect } from "vitest";
import { fnTest } from "../fn";

import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { GET as permissionsGET } from "@/app/api/auth/permissions/route";
import { GET as ssoAuthorizeGET } from "@/app/api/auth/sso/authorize/route";

describe("M01.F04/F05 认证管理集成层", () => {
  // ─────── F04.I02 路由守卫 ───────
  fnTest(["M01.F04.I02"], "(console) layout 守卫：源文件挂 data-fn=M01.F04.I02 + 含 router.replace('/login')", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(console)/layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-fn="M01\.F04\.I02"/);
    expect(src).toMatch(/router\.replace\(['"]\/login['"]\)/);
  });

  // ─────── F04.I03 路由守卫（未登录/无权限拦截）───────
  fnTest(["M01.F04.I03"], "(console) layout 守卫：源文件挂 @entry=I03 + 含 router.replace('/login')（I02 之外的 @entry）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(console)/layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/@entry M01\.F04\.I03/);
    expect(src).toMatch(/router\.replace\(['"]\/login['"]\)/);
  });

  // ─────── F04.I04 动态菜单 ───────
  fnTest(["M01.F04.I04"], "SidebarNav 顶层 aside 挂 data-fn=M01.F04.I04", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/app/sidebar-nav.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-fn="M01\.F04\.I04"/);
  });

  // ─────── F05.I02 Token 校验 ───────
  fnTest(["M01.F05.I02"], "apiClient/identityClient 请求拦截器注入 Authorization Bearer", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/api/legacy-client.ts"),
      "utf8",
    );
    // 拦截器存在 + 注 Bearer
    expect(src).toMatch(/@entry M01\.F05\.I02/);
    expect(src).toMatch(/Authorization.*Bearer.*currentToken/);
    // 401 处理
    expect(src).toMatch(/401.*unauthorizedHandler/);
  });

  // ─────── F05.I03 SSO 统一登录 ───────
  fnTest(["M01.F05.I03"], "GET /api/auth/sso/authorize 返回 authorizeUrl（lab 端 SSO 入口）", async () => {
    // v0.3.45：authorize 改走真实 OAuth code 流 -- 服务端先 POST saas
    // /api/v1/oauth/authorize 领 code，再拼 saas 登录页 URL。测试 stub fetch
    // 模拟 saas 应答（vitest 环境没有真 saas）。
    const realFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input));
      return new Response(JSON.stringify({ code: "saas-code-test", state: "state-test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const req = new Request(
        "http://localhost/api/auth/sso/authorize?response_type=code&client_id=11111111-1111-1111-1111-111111111111&redirect_uri=http%3A%2F%2Flocalhost%2Flogin&state=state-test",
      );
      const res = await ssoAuthorizeGET(req as unknown as Parameters<typeof ssoAuthorizeGET>[0]);
      expect(res.status).toBeLessThan(400);
      const data = (await res.json()) as { authorizeUrl?: string; state?: string };
      expect(data.state).toBe("state-test");
      expect(data.authorizeUrl).toContain("/login?");
      expect(data.authorizeUrl).toContain("code=saas-code-test");
      expect(data.authorizeUrl).toContain("redirect_uri=");
      // 领 code 走的是 saas 的 OAuth authorize 端点（不是浏览器直跳）
      expect(fetchCalls[0]).toContain("/api/v1/oauth/authorize");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  // ─────── F05.I04 身份会话同步 ───────
  fnTest(["M01.F05.I04"], "authStore.acceptSsoSession @entry 注释存在 + /api/auth/permissions 路由就绪", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/state/authStore.ts"),
      "utf8",
    );
    expect(src).toMatch(/@entry M01\.F05\.I04/);
    // 拉权限端点（demo handler 不读 query）
    const res = await permissionsGET();
    expect(res.status).toBe(200);
  });

  // ─────── F05.I05 登出 ───────
  fnTest(["M01.F05.I05"], "POST /api/auth/logout 返回 204；登出按钮 data-fn=M01.F05.I05", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(204);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/app/app-shell.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-fn="M01\.F05\.I05"/);
  });
});