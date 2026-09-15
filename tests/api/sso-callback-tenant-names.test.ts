// SSO callback 租户显示名回归。
//
// 缺口：saas memberships 契约（/me、/me/tenants）只有 tenantId（UUID）不带租户名，
// callback 曾把 name/tenantCode 全填 tenantId → 租户切换器显示一串 UUID。
// 修复：callback 瞬时持 accessToken 时顺手拉 saas GET /api/v1/admin/tenants
// （guard 只验 JWT，任何登录用户可读）建 tenantId→{name, tenantKey} 映射，
// 填进登录响应 tenants 与 membership snapshot（/api/auth/me 同源读取，切换器数据源）。
// 拉取失败只 warn 不阻塞登录（name 降级 tenantId，与菜单快照同款 best-effort 模式）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_NAME = "市住建工程质量检测中心";
const TENANT_KEY = "city-lab";

/** demo 路由只解 payload 不验签，伪造三段 JWT 即可。 */
function fakeJwt(sub: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ sub })}.sig`;
}

/** stub saas 四个端点：token / me / admin/tenants / me/menus。 */
function saasFetchStub(calls: string[], tenantsOk = true) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("/api/v1/me/menus")) return json([]);
    if (url.includes("/api/v1/oauth/token")) {
      return json({ accessToken: fakeJwt("u-1"), refreshToken: "r-1" });
    }
    if (url.includes("/api/v1/me")) {
      return json({
        id: "u-1",
        email: "u1@lab.dev",
        displayName: "用户一",
        memberships: [{ tenantId: TENANT_A, roleIds: [], status: "active" }],
      });
    }
    if (url.includes("/api/v1/admin/tenants")) {
      if (!tenantsOk) return json({ message: "boom" }, 500);
      return json({
        items: [{ id: TENANT_A, name: TENANT_NAME, tenantKey: TENANT_KEY }],
        total: 1,
      });
    }
    return json({ message: `unexpected ${url}` }, 404);
  });
}

async function postCallback(): Promise<Response> {
  const { POST } = await import("@/app/api/auth/sso/callback/route");
  return POST(
    new Request("http://localhost:5201/api/auth/sso/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: "c-1",
        redirect_uri: "http://localhost:5201/login",
        state: "st-1",
      }),
    }),
  );
}

describe("POST /api/auth/sso/callback 租户显示名", () => {
  beforeEach(async () => {
    process.env.SAAS_IDP_URL = "http://localhost:5101";
    process.env.SAAS_OAUTH_CLIENT_ID = "lab-management";
    process.env.SAAS_OAUTH_CLIENT_SECRET = "lab-management-secret";
    process.env.SAAS_TENANT_ID = TENANT_A;
    const { __resetMembershipSnapshotCache } = await import(
      "@/lib/auth/membership-snapshot"
    );
    __resetMembershipSnapshotCache();
  });

  it("登录响应 tenants 与 membership snapshot 带真名，不再拿 tenantId 充名字", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", saasFetchStub(calls));

    const res = await postCallback();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenants: Array<{ tenantId: string; code: string; name: string; roleIds: string[] }>;
    };
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0]!.tenantId).toBe(TENANT_A);
    expect(body.tenants[0]!.name).toBe(TENANT_NAME);
    expect(body.tenants[0]!.code).toBe(TENANT_KEY);
    expect(body.tenants[0]!.roleIds).toEqual([]);
    // 旧 demo 形状（tenantCode/tenantName）已收敛到契约 MyTenant —— 不得回潮
    expect(body.tenants[0]).not.toHaveProperty("tenantCode");
    expect(body.tenants[0]).not.toHaveProperty("tenantName");

    // snapshot 与登录响应同源：/api/auth/me（切换器数据源）读出的也是真名
    const { GET: meGET } = await import("@/app/api/auth/me/route");
    const meRes = await meGET(
      new Request("http://localhost:5201/api/auth/me", {
        headers: { authorization: `Bearer ${fakeJwt("u-1")}` },
      }),
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      tenants: Array<{ tenantId: string; code: string; name: string }>;
    };
    expect(meBody.tenants[0]!.name).toBe(TENANT_NAME);
    expect(meBody.tenants[0]!.code).toBe(TENANT_KEY);

    // 确实拉了 saas 平台租户列表
    expect(calls.some((u) => u.includes("/api/v1/admin/tenants"))).toBe(true);
  });

  it("saas 租户列表不可达时降级：登录不阻塞，名字回退 tenantId", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", saasFetchStub(calls, false));

    const res = await postCallback();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenants: Array<{ tenantId: string; name: string }>;
    };
    expect(body.tenants[0]!.tenantId).toBe(TENANT_A);
    expect(body.tenants[0]!.name).toBe(TENANT_A);
  });
});
