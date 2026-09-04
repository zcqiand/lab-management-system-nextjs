// fnTest — /api/auth/menus miss 自愈（2026-09-04 线上刷新崩溃修复）。
//
// 线上指纹：部署重启容器 → 内存菜单快照清空 → 浏览器持旧 token 的用户刷新页面
// → GET /api/auth/menus 503 MENUS_UNAVAILABLE → useBackendMenus 抛错 →
// ErrorBoundary「菜单加载失败」错误态（用户视角：页面崩了）。
//
// 修复语义（对齐 login route 的 service-account 链）：
//   miss 时先尝试 serviceLogin + cacheMenuSnapshot 自愈重拉：
//     - 拉到（含空树）→ 写快照 → 200 返回
//     - saas 不可达/登录失败 → 保持 503（既有错误语义不变）
//   SSO 用户（真 saas accessToken sub）同样受益：service 账号拉的是同一棵
//   lab-management 菜单树（demo 阶段菜单按 app 不按用户差异分发）。

import { describe, beforeEach, expect, vi, afterEach } from "vitest";
import { fnTest } from "../fn";

import { GET as menusGET } from "@/app/api/auth/menus/route";
import { __resetMenuSnapshotCache, type ContractMenuNode } from "@/lib/auth/menu-snapshot";

function fakeJwt(sub: string): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url({ alg: "none" })}.${b64url({ sub })}.${b64url({ sig: 0 })}`;
}

function reqWithBearer(token: string | null): Request {
  return new Request("http://localhost/api/auth/menus", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const origFetch = globalThis.fetch;

describe("/api/auth/menus miss 自愈", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetMenuSnapshotCache();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  /** mock saas 两跳：POST /auth/login（服务账号）→ GET /me/menus。 */
  function mockSaasOk(menuTree: unknown[] = []): void {
    fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/api/v1/auth/login")) {
        return new Response(JSON.stringify({ accessToken: "svc-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("/api/v1/me/menus")) {
        return new Response(
          JSON.stringify({ "lab-management": menuTree }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  }

  fnTest(["M01.F04.I04"], "miss + saas 可达 → 自愈重拉 → 200 菜单树", async () => {
    mockSaasOk([{ id: "m-dash", name: "仪表盘", path: "dashboard" }]);

    const res = await menusGET(reqWithBearer(fakeJwt("restarted-user")));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ContractMenuNode[];
    expect(body).toEqual([{ id: "m-dash", label: "仪表盘", path: "dashboard" }]);
  });

  fnTest(["M01.F04.I04"], "miss + saas 登录失败 → 仍 503 MENUS_UNAVAILABLE（错误语义不变）", async () => {
    fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/api/v1/auth/login")) {
        return new Response(JSON.stringify({ code: "INVALID" }), { status: 401 });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await menusGET(reqWithBearer(fakeJwt("user-no-saas")));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { code: string }).code).toBe("MENUS_UNAVAILABLE");
    expect(warnSpy).toHaveBeenCalled();
  });

  fnTest(["M01.F04.I04"], "miss + 网络不可达 → 仍 503（不炸不挂起）", async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await menusGET(reqWithBearer(fakeJwt("user-net-down")));
    expect(res.status).toBe(503);
  });

  fnTest(["M01.F04.I04"], "无 Authorization 返 401（ADR-0019 删 demo USER-A 兜底）", async () => {
    // ADR-0019：删「无 Bearer = USER-A 走自愈」反模式。
    mockSaasOk([]);

    const res = await menusGET(reqWithBearer(null));
    expect(res.status).toBe(401);
  });

  fnTest(["M01.F04.I04"], "自愈成功后再次 miss 应走缓存命中——不重复调 saas serviceLogin（限流兜底）", async () => {
    mockSaasOk([{ id: "m-dash", name: "仪表盘", path: "dashboard" }]);

    // 第一次 miss → 走 serviceLogin 自愈 → 200 + 缓存写入
    const first = await menusGET(reqWithBearer(fakeJwt("user-rate-limit")));
    expect(first.status).toBe(200);

    // 第二次同 sub 请求：缓存命中，serviceLogin 必须不被再次调用
    const second = await menusGET(reqWithBearer(fakeJwt("user-rate-limit")));
    expect(second.status).toBe(200);

    // 全程只调一次 saas /auth/login（= serviceLogin），第二次 hit 缓存不再调
    const loginCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/v1/auth/login"),
    );
    expect(loginCalls).toHaveLength(1);
    // /me/menus 也只调一次（写入快照时一次，第二次直接命中缓存）
    const menusCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/v1/me/menus"),
    );
    expect(menusCalls).toHaveLength(1);
  });
});
