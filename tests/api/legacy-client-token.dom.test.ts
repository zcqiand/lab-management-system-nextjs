// legacy-client token 注入（2026-11-09 事故修复批）——TDD 先红。
//
// 事故指纹：/inspection-specialties 刷新后恒 401。legacy-client 的请求拦截器
// 注入的是模块作用域 currentToken，只在登录瞬间被 setToken；刷新页面后模块
// 重置为 null，且从不从 localStorage（lab.token）回填——而检测能力页等
// legacy 页面的全部取数走 apiClient → 裸发 → msw worker/BFF 401。
// 同一 localStorage token 对 orval 链路（http-client 拦截器直读 localStorage）一直有效。
//
// 修复契约（SSOT=backend-config.getToken()，即 localStorage lab.token）：
//   A. localStorage 预置 token → apiClient / identityClient 请求自带 Bearer（零登录动作）
//   B. localStorage 清除（登出/切后端清 key）→ 请求立即不带旧 token（无内存残留）
//   C. setToken() 写 localStorage（登录页兼容面不变，登录即持久化）
//
// 测试法：axios per-request 自定义 adapter 捕获拦截器处理后的 config.headers——
// 零网络、不依赖 msw handler 形状。jsdom 项目跑（localStorage）。
import { afterEach, describe, expect, it } from "vitest";
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { apiClient, identityClient, setToken } from "@/api/legacy-client";
import { TOKEN_STORAGE_KEY } from "@/api/backend-config";

// 三段形状即可——legacy 链路不验签，拦截器只透传字符串。
const FAKE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsInRlbmFudF9pZCI6InQxIn0.zzz";

function captureAdapter(): { adapter: AxiosAdapter; auth: () => string | null } {
  let seen: string | null = null;
  const adapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
    const h = (config.headers ?? {}) as { get?: (k: string) => string | undefined };
    seen = typeof h.get === "function" ? (h.get("Authorization") ?? null) : null;
    // 测试 shim：AxiosResponse.config 的 headers 类型收紧（必有），测试捕获场景
    // 显式收窄即可（真实 axios 生命周期里 headers 恒已就位）。
    return {
      data: {},
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    } as unknown as AxiosResponse;
  };
  return { adapter, auth: () => seen };
}

afterEach(() => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
});

describe("legacy-client token 注入（localStorage SSOT）", () => {
  it("A: localStorage 预置 token → apiClient/identityClient 请求自带 Bearer（刷新后回填，事故主证）", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, FAKE_JWT);
    const capA = captureAdapter();
    await apiClient.get("/api/inspection/specialties", { adapter: capA.adapter });
    expect(capA.auth()).toBe(`Bearer ${FAKE_JWT}`);

    const capB = captureAdapter();
    await identityClient.get("/api/auth/me", { adapter: capB.adapter });
    expect(capB.auth()).toBe(`Bearer ${FAKE_JWT}`);
  });

  it("B: localStorage 清除（登出/切后端）→ 请求立即不带旧 token（无内存残留）", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, FAKE_JWT);
    // 预热一次内存态（旧实现里 setToken 会钉住模块变量）
    setToken(FAKE_JWT);
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    const cap = captureAdapter();
    await apiClient.get("/api/inspection/specialties", { adapter: cap.adapter });
    expect(cap.auth()).toBeNull();
  });

  it("C: setToken() 同步写 localStorage（登录页兼容面：登录即持久化）", () => {
    setToken(FAKE_JWT);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(FAKE_JWT);
  });
});
