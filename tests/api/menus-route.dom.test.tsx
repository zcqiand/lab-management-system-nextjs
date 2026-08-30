// ADR-0009 fnTest — GET /api/auth/menus route：saas 快照缓存 → miss 503。
//
// 数据链三段（与 lab-springboot AuthService.menus 同语义）：
//   1. Bearer JWT sub 命中快照缓存 → 返回快照（SSO callback / 密码登录时 cacheMenuSnapshot 写入）
//   2. miss（无 token / 无 sub / 过期 / 未缓存）→ 503 MENUS_UNAVAILABLE
//      （2026-08-27 起 demo 兜底删除：假树不再下发，前端回退静态菜单）
// 直接调 route handler（auth.dom.test.tsx 同款模式）；menu-snapshot 缓存单测
// 覆盖 TTL 与映射。

import { describe, beforeEach, expect } from "vitest";
import { fnTest } from "../fn";

import { GET as menusGET } from "@/app/api/auth/menus/route";
import {
  putMenuSnapshot,
  getMenuSnapshot,
  __resetMenuSnapshotCache,
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
