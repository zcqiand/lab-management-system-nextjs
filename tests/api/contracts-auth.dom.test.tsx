// contracts 前端取数层 Bearer 接线 — BFF 全域 token 化 P4。
//
// useContracts 经 contracts.ts 的 fetchJson 裸 fetch 同源 /api/contracts；
// P2 起 BFF 对匿名请求 401，前端必须自带 Authorization: Bearer <token>。
// 本文件锁定接线：localStorage("lab.token") 的 token 被取数层附带出去。
// msw server.use() 一次性覆盖 handler 捕获请求头（jsdom 环境走 node msw）。
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useContracts } from "@/api/contracts";
import { TOKEN_STORAGE_KEY } from "@/api/backend-config";

const captured: string[] = [];

// setup.dom 的 afterEach 会 resetHandlers()——覆盖必须每个测试重新注册
beforeEach(async () => {
  const { server } = await import("../setup.dom");
  const { http, HttpResponse } = await import("msw");
  server.use(
    http.get("*/api/contracts", ({ request }) => {
      captured.push(request.headers.get("authorization") ?? "");
      return HttpResponse.json({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });
    }),
  );
});

afterEach(() => {
  captured.length = 0;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("contracts 取数层 Bearer 接线（BFF 全域 token 化 P4）", () => {
  it("localStorage 无 token：请求不带 Authorization 头", async () => {
    const { result } = renderHook(() => useContracts(), { wrapper });
    // msw 覆盖 handler 恒 200 应答（只捕获头），query 恒 success——断言的是头
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(captured[0]).toBe("");
  });

  it("localStorage 有 token：fetchJson 附带 Authorization: Bearer <token>", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "test-jwt-token");
    const { result } = renderHook(() => useContracts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(captured[0]).toBe("Bearer test-jwt-token");
  });
});
