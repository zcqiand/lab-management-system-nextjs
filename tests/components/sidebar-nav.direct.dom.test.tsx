// ADR-0009（2026-08-25）— sidebar-nav 菜单走 lab 后端 GET /api/auth/menus
//（取代 v0.3.47 浏览器直连 saas /api/v1/me/menus）
//
// 锁住四件事：
//   1. 请求走 orval authGetMenus → axios GET /api/auth/menus + Bearer token
//      （来自 useAuth().token；SSO callback 拿到的 saas accessToken）
//   2. 401 时 clearToken + window.location.assign('/login')
//   3. hydration 竞态：!token 时不发请求（auth-context mount 后才 hydrate）
//   4. 契约 MenuNode{id,label,path?,icon?,children?} 适配为本地渲染树
//      （label→name，有子节点=group）
//   5. 2026-08-27 起 demo 兜底删除：500 miss → render 抛错上抛 ErrorBoundary，
//      不静默回退静态树（与 react/vue 仓同语义）
// useSaasApp 仍直连 saas /api/v1/apps/[code]（免鉴权公共目录），测试保留。

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// -- axios mock：authGetMenus 走 customFetch → axios(config) ------------------
// 工厂内直接记录调用（vi.mock 工厂与 spyOn 不兼容：mock 过的模块没有可 spy 的属性）。

type MockResponse = { status: number; data: unknown };
const queue: MockResponse[] = [];
const calls: { url?: string; headers?: Record<string, string> }[] = [];

vi.mock("axios", () => ({
  default: async (config: { url?: string; headers?: Record<string, string> }) => {
    calls.push({ url: config?.url, headers: config?.headers });
    const r = queue.shift();
    if (!r || r.status >= 400) {
      throw Object.assign(new Error(`HTTP ${r?.status ?? "no-mock"}`), {
        response: r ? { status: r.status, data: r.data } : undefined,
        isAxiosError: true,
      });
    }
    return { status: r.status, data: r.data };
  },
  isAxiosError: (e: unknown) => e instanceof Error && "isAxiosError" in (e as object),
  create: () => {
    throw new Error("menus 测试不应触达 axios.create");
  },
}));

import { useBackendMenus, useSaasApp } from "@/components/app/sidebar-nav";
import { AuthProvider } from "@/state/auth-context";

// RTL 的 renderHook wrapper 形参是 props（含 children），不是 children 本身。
function wrap({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("ADR-0009 sidebar-nav 菜单走 lab 后端 /api/auth/menus", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queue.length = 0;
    calls.length = 0;
    // useSaasApp 仍走 fetch（saas 公共目录）；axios mock 只盯 /api/auth/menus
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "lab-management",
          name: "建筑工程实验室管理系统",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("useBackendMenus：token 有值 → GET /api/auth/menus + Bearer + 契约树适配", async () => {
    localStorage.setItem("lab.token", "test-jwt-from-sso");
    queue.push({
      status: 200,
      data: [
        {
          id: "overview",
          label: "总览",
          children: [
            {
              id: "dashboard",
              label: "仪表盘",
              path: "/dashboard",
              icon: "LayoutDashboard",
            },
          ],
        },
        { id: "solo", label: "独立页", path: "/solo" },
      ],
    });

    const { result } = renderHook(() => useBackendMenus(), { wrapper: wrap });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    // 端点 + Bearer
    expect(calls).toEqual([
      { url: "/api/auth/menus", headers: { Authorization: "Bearer test-jwt-from-sso" } },
    ]);
    // 适配：label→name，有子节点=group，无子节点=page
    const [g, solo] = result.current.data!;
    expect(g!.name).toBe("总览");
    expect(g!.type).toBe("group");
    expect(g!.children[0]!.name).toBe("仪表盘");
    expect(g!.children[0]!.type).toBe("page");
    expect(solo!.type).toBe("page");
  });

  it("useBackendMenus：!token 时不发请求（hydration 竞态防护）", async () => {
    // 不写 localStorage.lab.token；auth-context 首次 render token=null
    renderHook(() => useBackendMenus(), { wrapper: wrap });

    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/menus"),
    );
  });

  it("useBackendMenus：401 → clearToken + window.location.assign('/login')", async () => {
    localStorage.setItem("lab.token", "expired-jwt");
    queue.push({ status: 401, data: {} });
    // window.location 在 jsdom 里是 read-only；用 defineProperty 临时覆盖 assign
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    try {
      renderHook(() => useBackendMenus(), { wrapper: wrap });

      await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("/login"));
      // clearToken 副作用：localStorage.lab.token 应已被清掉
      expect(localStorage.getItem("lab.token")).toBeNull();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });

  it("useSaasApp：仍直连 saas /api/v1/apps/[code]（公共目录，不走后端）", async () => {
    localStorage.setItem("lab.token", "test-jwt");

    renderHook(() => useSaasApp(), { wrapper: wrap });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
    const [url] = lastCall;
    expect(url).toBe("http://localhost:5101/api/v1/apps/lab-management");
  });
});

describe("M01.F04.I04 useBackendMenus — demo 兜底删除后失败语义", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queue.length = 0;
    calls.length = 0;
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "lab-management", name: "建筑工程实验室管理系统" }), {
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("500 miss → render 抛错（不静默回退静态树），ErrorBoundary 接住", async () => {
    localStorage.setItem("lab.token", "ok-jwt");
    queue.push({ status: 500, data: { message: "boom" } });
    // ErrorBoundary：捕获子组件 render 阶段抛错
    class MB extends React.Component<{ children: ReactNode }, { err: Error | null }> {
      override state = { err: null as Error | null };
      static getDerivedStateFromError(err: Error) {
        return { err };
      }
      override render() {
        if (this.state.err) {
          return <div data-testid="menus-error">{this.state.err.message}</div>;
        }
        return this.props.children;
      }
    }
    // 用 RTL render（不是 renderHook）— renderHook 不会触发 ErrorBoundary。
    const { default: TestRenderer } = await import("@testing-library/react");
    TestRenderer.render(
      <AuthProvider>
        <MB>
          <HarnessProbe />
        </MB>
      </AuthProvider>,
    );
    // 错误边界接住抛错，渲染错误态（不再是 null 兜底）
    await waitFor(() => {
      const errNode = document.querySelector('[data-testid="menus-error"]');
      expect(errNode?.textContent).toMatch(/HTTP 500/);
    });
  });
});

/** 极简 probe：调用 useBackendMenus 但不读任何返回字段，让 render 阶段抛错
 *  传到 ErrorBoundary。挂在 ErrorBoundary 子树下让边界接住抛错。 */
function HarnessProbe() {
  useBackendMenus();
  return <div data-testid="probe" />;
}
