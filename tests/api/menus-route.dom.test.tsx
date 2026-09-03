// ADR-0009 fnTest — GET /api/auth/menus route：saas 快照缓存 → miss 503。
//
// 数据链三段（与 lab-springboot AuthService.menus 同语义）：
//   1. Bearer JWT sub 命中快照缓存 → 返回快照（SSO callback / 密码登录时 cacheMenuSnapshot 写入）
//   2. miss（无 token / 无 sub / 过期 / 未缓存）→ 503 MENUS_UNAVAILABLE
//      （2026-08-27 起 demo 兜底删除：假树不再下发，前端回退静态菜单）
// 直接调 route handler（auth.dom.test.tsx 同款模式）；menu-snapshot 缓存单测
// 覆盖 TTL 与映射。

import { describe, beforeEach, expect, vi, afterEach } from "vitest";
import { fnTest } from "../fn";

import { GET as menusGET } from "@/app/api/auth/menus/route";
import {
  putMenuSnapshot,
  getMenuSnapshot,
  __resetMenuSnapshotCache,
  cacheMenuSnapshot,
  type ContractMenuNode,
} from "@/lib/auth/menu-snapshot";

/** 造一个 payload 段为 {sub} 的伪 JWT（route 只解不验签，签名段任意）。 */
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

beforeEach(() => {
  __resetMenuSnapshotCache();
});

describe("ADR-0009 /api/auth/menus 快照链", () => {
  fnTest(["M01.F04.I04"], "快照命中：Bearer sub 有快照 → 返回快照树", async () => {
    const snap: ContractMenuNode[] = [
      { id: "g1", label: "saas 分组", children: [{ id: "leaf", label: "saas 页面", path: "/p" }] },
    ];
    putMenuSnapshot("user-1", snap);

    const res = await menusGET(reqWithBearer(fakeJwt("user-1")));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ContractMenuNode[];
    expect(body).toEqual(snap);
  });

  fnTest(["M01.F04.I04"], "快照 miss：无 token / sub 无快照 → 503 MENUS_UNAVAILABLE", async () => {
    // 无 Authorization
    const res1 = await menusGET(reqWithBearer(null));
    expect(res1.status).toBe(503);
    expect(((await res1.json()) as { code: string }).code).toBe("MENUS_UNAVAILABLE");

    // 有 token 但该 sub 从未缓存
    const res2 = await menusGET(reqWithBearer(fakeJwt("stranger")));
    expect(res2.status).toBe(503);

    // 非三段 token（不是 JWT）→ sub 解不出 → 同样 503
    const res3 = await menusGET(reqWithBearer("not-a-jwt"));
    expect(res3.status).toBe(503);
  });

  fnTest(["M01.F04.I01"], "动态菜单下发：route 文件 @entry M01.F04.I01 锚点存在", async () => {
    // I01 是「菜单下发」API 端点本身；功能树要求源码挂锚点，避免锚点丢失
    // 后 L5 误报已上线却无入口。
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/auth/menus/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/@entry M01\.F04\.I01/);
    expect(src).toMatch(/export async function GET/);
  });
});

describe("menu-snapshot 缓存单测", () => {
  fnTest(["M01.F04.I04"], "getMenuSnapshot：未写入/空 userId → null；写入后可读", () => {
    expect(getMenuSnapshot("nobody")).toBeNull();
    expect(getMenuSnapshot(null)).toBeNull();

    const tree: ContractMenuNode[] = [{ id: "a", label: "A" }];
    putMenuSnapshot("u9", tree);
    expect(getMenuSnapshot("u9")).toEqual(tree);

    // 空参静默忽略（cacheMenuSnapshot 防御分支的同款输入）
    putMenuSnapshot(null, tree);
    putMenuSnapshot("u9", null);
    expect(getMenuSnapshot("u9")).toEqual(tree); // null menus 不覆盖已有快照
  });
});

// ---------------------------------------------------------------------------
// cacheMenuSnapshot：saas /api/v1/me/menus 响应形状为 Record<appCode, EffectiveMenuNode[]>
// （shared 契约 tsp/routes/me.tsp:24，2026-08-28 真实现上线）。
// 必须按 appCode 取子树再做 SaasMenuNode → ContractMenuNode 映射。
// 之前 as SaasMenuNode[] flat cast 是错的——i.map is not a function。
describe("cacheMenuSnapshot：saas /me/menus Record<appCode, EffectiveMenuNode[]> 解析", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetMenuSnapshotCache();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  function mockSaas(body: unknown, status = 200): ReturnType<typeof vi.fn> {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  fnTest(["M01.F04.I04"], "Record 形状：appCode 命中 → 写入子树 + 完成 name→label 映射 + 跨 app 数据不污染", async () => {
    mockSaas({
      "lab-management": [
        {
          id: "g1",
          name: "分组1",
          path: null,
          icon: null,
          children: [{ id: "p1", name: "页面1", path: "/p1", icon: "Icon1" }],
        },
        { id: "p2", name: "页面2", path: "/p2" },
      ],
      erp: [{ id: "erp-1", name: "ERP 页" }], // 跨 app 数据，绝不能进 lab 快照
    });

    await cacheMenuSnapshot("user-x", "tok", "http://saas", "lab-management");

    expect(getMenuSnapshot("user-x")).toEqual([
      {
        id: "g1",
        label: "分组1",
        children: [{ id: "p1", label: "页面1", path: "/p1", icon: "Icon1" }],
      },
      { id: "p2", label: "页面2", path: "/p2" },
    ]);

    // URL 带 appCode query 参数 + Bearer header
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
    expect(String(calledUrl)).toContain("/api/v1/me/menus?appCode=lab-management");
    expect((calledInit as RequestInit).headers).toMatchObject({
      authorization: "Bearer tok",
    });
  });

  fnTest(["M01.F04.I04"], "Record 形状：appCode 不在响应里 → 写空快照（与 no-sso 兜底四方对齐）", async () => {
    mockSaas({ erp: [{ id: "erp-1", name: "ERP 页" }] });

    await cacheMenuSnapshot("user-y", "tok", "http://saas", "lab-management");

    expect(getMenuSnapshot("user-y")).toEqual([]); // 空数组 ≠ null，仍是合法快照
  });

  fnTest(["M01.F04.I04"], "Record 形状：响应是空对象 → 写空快照", async () => {
    mockSaas({});

    await cacheMenuSnapshot("user-z", "tok", "http://saas", "lab-management");

    expect(getMenuSnapshot("user-z")).toEqual([]);
  });

  fnTest(["M01.F04.I04"], "5xx → 不写快照 + warn（登录主流程不阻塞）", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockSaas({ code: "INTERNAL", message: "boom" }, 503);

    await cacheMenuSnapshot("user-w", "tok", "http://saas", "lab-management");

    expect(getMenuSnapshot("user-w")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[menu-snapshot] saas /me/menus 503"),
    );
  });

  fnTest(["M01.F04.I04"], "网络异常 → 不写快照 + warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cacheMenuSnapshot("user-v", "tok", "http://saas", "lab-management");

    expect(getMenuSnapshot("user-v")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("fetch failed for user user-v"),
    );
  });

  fnTest(["M01.F04.I04"], "userId/token 空 → 静默不写不发请求", async () => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cacheMenuSnapshot(null, "tok", "http://saas");
    await cacheMenuSnapshot("u", "", "http://saas");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getMenuSnapshot(null)).toBeNull();
    expect(getMenuSnapshot("u")).toBeNull();
  });
});
