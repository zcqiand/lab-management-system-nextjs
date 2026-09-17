// backend-config 运行时切换语义（2026-09-14 用户裁定恢复，对齐 saas 家族）。
// node 环境（无 localStorage）：用内存 stub 模拟 jsdom 语义，
// 覆盖 选择→baseURL/mode 跟随、nextjs-self 空串不被吞、未知 key 落 env、持久化。
import { afterEach, describe, expect, it } from "vitest";

import {
  BACKENDS,
  SELECTABLE_BACKENDS,
  getApiBaseUrl,
  getApiMode,
  getSelectedBackend,
  resolveSelectedBackendUrl,
  setSelectedBackend,
} from "@/api/backend-config";

function installFakeLocalStorage(): void {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = fake;
}

function uninstallFakeLocalStorage(): void {
  delete (globalThis as { localStorage?: unknown }).localStorage;
}

describe("backend-config 运行时切换", () => {
  afterEach(() => {
    uninstallFakeLocalStorage();
  });

  it("dev 构建下 3 后端全部可选（端口表 = multi-repo-family §6；msw 仓 2026-09-17 已删）", () => {
    expect(SELECTABLE_BACKENDS).toHaveLength(3);
    expect(BACKENDS.map((b) => b.key)).toEqual([
      "nextjs-self",
      "aspnetcore",
      "springboot",
    ]);
    expect(BACKENDS.find((b) => b.key === "nextjs-self")?.baseUrl).toBe("");
    expect(BACKENDS.find((b) => b.key === "aspnetcore")?.baseUrl).toBe("http://localhost:5204");
    expect(BACKENDS.find((b) => b.key === "springboot")?.baseUrl).toBe("http://localhost:5205");
  });

  it("未选择时走 env 默认（NEXT_PUBLIC_API_BASE_URL，setup.ts seed 空串=同源）", () => {
    installFakeLocalStorage();
    expect(getSelectedBackend()).toBe("");
    expect(getApiBaseUrl()).toBe(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
    expect(getApiMode()).toBe(process.env.NEXT_PUBLIC_API_MODE || "nextjs-self");
  });

  it("选择 aspnetcore → baseURL/mode 跟随选中项，且持久化到 localStorage", () => {
    installFakeLocalStorage();
    setSelectedBackend("aspnetcore");
    expect(getSelectedBackend()).toBe("aspnetcore");
    expect(getApiBaseUrl()).toBe("http://localhost:5204");
    expect(getApiMode()).toBe("aspnetcore");
    expect(globalThis.localStorage.getItem("lab.api.backend")).toBe("aspnetcore");
  });

  it("选择 nextjs-self → 空串 baseURL（同源）必须原样返回，不能 || 吞掉", () => {
    installFakeLocalStorage();
    setSelectedBackend("nextjs-self");
    expect(getApiBaseUrl()).toBe("");
    expect(getApiMode()).toBe("nextjs-self");
  });

  it("选择 springboot → http://localhost:5205", () => {
    installFakeLocalStorage();
    setSelectedBackend("springboot");
    expect(getApiBaseUrl()).toBe("http://localhost:5205");
  });

  it("未知/已下线 key（localStorage 跨构建遗留）→ 落 env 默认", () => {
    installFakeLocalStorage();
    globalThis.localStorage.setItem("lab.api.backend", "retired-backend");
    expect(getSelectedBackend()).toBe("retired-backend");
    expect(getApiBaseUrl()).toBe(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
    expect(getApiMode()).toBe(process.env.NEXT_PUBLIC_API_MODE || "nextjs-self");
  });

  it("setSelectedBackend(\"\") 清除选择 → 回 env 默认", () => {
    installFakeLocalStorage();
    setSelectedBackend("springboot");
    setSelectedBackend("");
    expect(getSelectedBackend()).toBe("");
    expect(getApiBaseUrl()).toBe(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
    expect(globalThis.localStorage.getItem("lab.api.backend")).toBeNull();
  });

  it("切换后端时清 lab.token（旧 token 对新验签方必然无效）；同值重复 set 不清", () => {
    installFakeLocalStorage();
    setSelectedBackend("aspnetcore");
    globalThis.localStorage.setItem("lab.token", "stale-jwt-from-old-backend");
    // 同值 set：不重置会话（防 dropdown 重复点选误伤）
    setSelectedBackend("aspnetcore");
    expect(globalThis.localStorage.getItem("lab.token")).toBe("stale-jwt-from-old-backend");
    // 真切换：token 必须清（2026-09-15 401 事故——5205 自定义 key 铸的 token 带到 5204 验不过）
    setSelectedBackend("springboot");
    expect(globalThis.localStorage.getItem("lab.token")).toBeNull();
    expect(globalThis.localStorage.getItem("lab.api.backend")).toBe("springboot");
  });

  it("从已选切回 env 默认（\"\")同样清 lab.token", () => {
    installFakeLocalStorage();
    setSelectedBackend("aspnetcore");
    globalThis.localStorage.setItem("lab.token", "t");
    setSelectedBackend("");
    expect(globalThis.localStorage.getItem("lab.token")).toBeNull();
    expect(globalThis.localStorage.getItem("lab.api.backend")).toBeNull();
  });

  it("resolveSelectedBackendUrl：key → URL，未知 key → 空串", () => {
    expect(resolveSelectedBackendUrl("aspnetcore")).toBe("http://localhost:5204");
    expect(resolveSelectedBackendUrl("nextjs-self")).toBe("");
    expect(resolveSelectedBackendUrl("nope")).toBe("");
  });

  it("localStorage 抛异常（SSR/隐私模式）不崩：get 返空串、set 静默", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(getSelectedBackend()).toBe("");
    expect(() => setSelectedBackend("springboot")).not.toThrow();
    expect(getApiBaseUrl()).toBe(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
  });
});
