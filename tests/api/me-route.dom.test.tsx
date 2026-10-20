// 2026-09-03 租户体系对齐单测 — GET /api/auth/me route：Bearer sub 的
// memberships 快照 hit → saas 租户体系；miss → 401（前端 refresh 自愈）；
// 无 Bearer → 401（ADR-0019）。
// 2026-10-21 ADR-0019 收口（镜像 rails resolve_user）：user 一律来自 user
// 快照（login/sso/callback 写入）——写死 DEMO_USER 字面量是「业务身份字段
// 兜底到 demo 字面量」反模式；miss → 401 USER_UNAVAILABLE。currentTenantId
// 优先取 JWT tenant_id claim（登录链已写 tenant_key），缺省落首租户。
// 设计：aspnetcore 仓 docs/superpowers/specs/2026-09-03-me-tenant-alignment-design.md
// 模式：menus-route.dom.test.tsx 同款（直接调 route handler + 伪 JWT）。

import { describe, it, beforeEach, expect } from "vitest";

import { GET as meGET } from "@/app/api/auth/me/route";
import {
  putMembershipSnapshot,
  __resetMembershipSnapshotCache,
  type SaasMyTenant,
} from "@/lib/auth/membership-snapshot";
import {
  putUserSnapshot,
  __resetUserSnapshotCache,
  type SnapshotUser,
} from "@/lib/auth/user-snapshot";

/** 造一个 payload 段为 {sub, ...extra} 的伪 JWT（route 只解不验签，签名段任意）。 */
function fakeJwt(sub: string, extra: Record<string, unknown> = {}): string {
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url({ alg: "none" })}.${b64url({ sub, ...extra })}.${b64url({ sig: 0 })}`;
}

function reqWithBearer(token: string | null): Request {
  return new Request("http://localhost/api/auth/me", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const SAAS_TENANTS: SaasMyTenant[] = [
  {
    tenantId: "00000000-0000-0000-0000-000000000001",
    code: "00000000-0000-0000-0000-000000000001",
    name: "00000000-0000-0000-0000-000000000001",
    roleIds: ["admin"],
  },
];

const SAAS_USER: SnapshotUser = {
  id: "saas-user-1",
  username: "alice@saas.local",
  displayName: "爱丽丝",
  roleCode: "admin",
};

beforeEach(() => {
  __resetMembershipSnapshotCache();
  __resetUserSnapshotCache();
});

describe("2026-09-03 /api/auth/me 租户体系对齐", () => {
  it("SSO 用户快照 hit：user 来自 user 快照（非 demo 字面量），currentTenantId 取 claim", async () => {
    putUserSnapshot("saas-user-1", SAAS_USER);
    putMembershipSnapshot("saas-user-1", SAAS_TENANTS);

    // 登录链签发的 lab JWT 带 tenant_id claim（2026-10-20 tenant_key 人裁）
    const res = await meGET(
      reqWithBearer(fakeJwt("saas-user-1", { tenant_id: "city-lab" })),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: SnapshotUser;
      tenants: SaasMyTenant[];
      currentTenantId: string;
    };
    expect(body.user).toEqual(SAAS_USER);
    expect(body.tenants).toEqual(SAAS_TENANTS);
    expect(body.currentTenantId).toBe("city-lab");
  });

  it("SSO 用户快照 hit 无 claim：currentTenantId 落首租户", async () => {
    putUserSnapshot("saas-user-1", SAAS_USER);
    putMembershipSnapshot("saas-user-1", SAAS_TENANTS);

    const res = await meGET(reqWithBearer(fakeJwt("saas-user-1")));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { currentTenantId: string };
    expect(body.currentTenantId).toBe(SAAS_TENANTS[0]!.tenantId);
  });

  it("user 快照 miss：有 Bearer 但 sub 无用户快照 → 401 USER_UNAVAILABLE（重登重建）", async () => {
    // 镜像 rails resolve_user：身份解析在前——目录里没这人就是 401，
    // 不能拿 DEMO_USER 字面量冒充（ADR-0019）
    const res = await meGET(reqWithBearer(fakeJwt("stranger")));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("USER_UNAVAILABLE");
  });

  it("membership 快照 miss（user 快照 hit）→ 401（前端 refresh 自愈）", async () => {
    putUserSnapshot("saas-user-1", SAAS_USER);

    const res = await meGET(reqWithBearer(fakeJwt("saas-user-1")));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("MEMBERSHIP_UNAVAILABLE");
  });

  it("demo 路径：删「无 Bearer = demo 租户」反模式 → 401（ADR-0019）", async () => {
    // ADR-0019：删「无 Bearer = demo 租户」反模式。无 Bearer 必须 401,与
    // 2026-08-27 msw demo 兜底删除原则对齐。前端必须先 login 拿 token。
    const res = await meGET(reqWithBearer(null));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
