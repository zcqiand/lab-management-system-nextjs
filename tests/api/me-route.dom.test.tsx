// 2026-09-03 租户体系对齐 fnTest — GET /api/auth/me route：Bearer sub 的
// memberships 快照 hit → saas 租户体系；miss → 401（前端 refresh 自愈）；
// 无 Bearer → demo 租户（现状不变）。
// 设计：aspnetcore 仓 docs/superpowers/specs/2026-09-03-me-tenant-alignment-design.md
// 模式：menus-route.dom.test.tsx 同款（直接调 route handler + 伪 JWT）。

import { describe, beforeEach, expect } from "vitest";
import { fnTest } from "../fn";

import { GET as meGET } from "@/app/api/auth/me/route";
import {
  putMembershipSnapshot,
  __resetMembershipSnapshotCache,
  type SaasMyTenant,
} from "@/lib/auth/membership-snapshot";

/** 造一个 payload 段为 {sub} 的伪 JWT（route 只解不验签，签名段任意）。 */
function fakeJwt(sub: string): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url({ alg: "none" })}.${b64url({ sub })}.${b64url({ sig: 0 })}`;
}

function reqWithBearer(token: string | null): Request {
  return new Request("http://localhost/api/auth/me", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const SAAS_TENANTS: SaasMyTenant[] = [
  { tenantId: "00000000-0000-0000-0000-000000000001", code: "00000000-0000-0000-0000-000000000001", name: "00000000-0000-0000-0000-000000000001", roleIds: ["admin"] },
];

beforeEach(() => {
  __resetMembershipSnapshotCache();
});

describe("2026-09-03 /api/auth/me 租户体系对齐", () => {
  fnTest(["M98.F03.I02"], "SSO 用户快照 hit：Bearer sub 有 memberships 快照 → 返回 saas 租户", async () => {
    putMembershipSnapshot("saas-user-1", SAAS_TENANTS);

    const res = await meGET(reqWithBearer(fakeJwt("saas-user-1")));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: SaasMyTenant[]; currentTenantId: string };
    expect(body.tenants).toEqual(SAAS_TENANTS);
    expect(body.currentTenantId).toBe(SAAS_TENANTS[0]!.tenantId);
  });

  fnTest(["M98.F03.I02"], "SSO 用户快照 miss：有 Bearer 但 sub 无快照 → 401（前端 refresh 自愈）", async () => {
    const res = await meGET(reqWithBearer(fakeJwt("stranger")));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("MEMBERSHIP_UNAVAILABLE");
  });

  fnTest(["M98.F03.I02"], "demo 路径：删「无 Bearer = demo 租户」反模式 → 401（ADR-0019）", async () => {
    // ADR-0019：删「无 Bearer = demo 租户」反模式。无 Bearer 必须 401,与
    // 2026-08-27 msw demo 兜底删除原则对齐。前端必须先 login 拿 token。
    const res = await meGET(reqWithBearer(null));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
