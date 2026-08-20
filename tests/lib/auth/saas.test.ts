// M01.F05.I07/I08 — SaasAuthClient + SaasMeClient 单测。
//
// 覆盖：
// - HttpSaasAuthClient.authorize 真调 saas /oauth/authorize，断言 body 字段+失败 4xx/5xx 映射
// - HttpSaasAuthClient.token 真调 saas /oauth/token，断言 grant_type 路由
// - HttpSaasMeClient.whoami / listMyTenants 走 Bearer 鉴权
// - 缺 env 构造抛
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpSaasAuthClient, HttpSaasMeClient, SaasAuthError } from "@/lib/auth/saas";

describe("M01.F05.I07 SaasAuthClient", () => {
  const fetches: Array<{ url: string; init: RequestInit }> = [];
  let originalFetch: typeof fetch;

  beforeEach(() => {
    fetches.length = 0;
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      fetches.push({ url: String(url), init });
      // 路径感知的默认 mock:authorize 返回 {code,state};token 返回 {accessToken,...}
      const u = String(url);
      const body = u.includes("/oauth/authorize")
        ? { code: "auth-code-xyz", state: "nonce-xyz" }
        : { accessToken: "saas-at", refreshToken: "saas-rt", tokenType: "Bearer", expiresIn: 3600, scope: "openid" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("authorize sends clientId/redirectUri/state/tenantId", async () => {
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "lab-client-id",
      clientSecret: "lab-client-secret",
      defaultTenantId: "00000000-0000-0000-0000-000000000001",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    const resp = await client.authorize("http://lab.local/cb", "openid profile", "nonce-xyz");
    expect(resp.code).toBe("auth-code-xyz");
    expect(resp.state).toBe("nonce-xyz");

    expect(fetches).toHaveLength(1);
    const sent = fetches[0]!;
    expect(sent.url).toBe("http://saas.local/api/v1/oauth/authorize");
    const body = JSON.parse(sent.init.body as string) as Record<string, string>;
    expect(body.clientId).toBe("lab-client-id");
    expect(body.responseType).toBe("code");
    expect(body.tenantId).toBe("00000000-0000-0000-0000-000000000001");
    expect(body.state).toBe("nonce-xyz");
  });

  it("token(authorization_code) sends grant_type + code + clientSecret", async () => {
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "lab-client-id",
      clientSecret: "lab-client-secret",
      defaultTenantId: "00000000-0000-0000-0000-000000000001",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    await client.token("authorization_code", "auth-code-xyz", null, "http://lab.local/cb");
    expect(fetches).toHaveLength(1);
    const body = JSON.parse(fetches[0]!.init.body as string) as Record<string, string>;
    expect(body.grantType).toBe("authorization_code");
    expect(body.code).toBe("auth-code-xyz");
    expect(body.clientSecret).toBe("lab-client-secret");
  });

  it("token(refresh_token) sends grantType=refresh_token + refreshToken", async () => {
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "lab-client-id",
      clientSecret: "lab-client-secret",
      defaultTenantId: "00000000-0000-0000-0000-000000000001",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    await client.token("refresh_token", null, "saas-rt-old", null);
    const body = JSON.parse(fetches[0]!.init.body as string) as Record<string, string>;
    expect(body.grantType).toBe("refresh_token");
    expect(body.refreshToken).toBe("saas-rt-old");
    expect(body.code).toBeUndefined();
  });

  it("401 maps to UnauthorizedClient", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 401 })) as typeof fetch;
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "x",
      clientSecret: "y",
      defaultTenantId: "z",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    const calls = await client.token("authorization_code", "code", null, "http://lab.local/cb").catch((e) => e);
    expect(calls).toBeInstanceOf(SaasAuthError);
    expect((calls as SaasAuthError).kind).toBe("unauthorized_client");
    expect((calls as SaasAuthError).status).toBe(401);
  });

  it("400 maps to InvalidGrant", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 400 })) as typeof fetch;
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "x",
      clientSecret: "y",
      defaultTenantId: "z",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    const calls = await client.token("authorization_code", "bad", null, "http://lab.local/cb").catch((e) => e);
    expect(calls).toBeInstanceOf(SaasAuthError);
    expect((calls as SaasAuthError).kind).toBe("invalid_grant");
  });

  it("5xx maps to UpstreamUnavailable", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 502 })) as typeof fetch;
    const client = new HttpSaasAuthClient({
      baseUrl: "http://saas.local",
      clientId: "x",
      clientSecret: "y",
      defaultTenantId: "z",
      callbacks: { redirectUri: "http://lab.local/cb" },
    });
    const calls = await client.token("authorization_code", "code", null, "http://lab.local/cb").catch((e) => e);
    expect(calls).toBeInstanceOf(SaasAuthError);
    expect((calls as SaasAuthError).kind).toBe("upstream");
    expect((calls as SaasAuthError).status).toBe(502);
  });

  it("construct validates required env", () => {
    expect(() => new HttpSaasAuthClient({ baseUrl: "", clientId: "x", clientSecret: "y", defaultTenantId: "z", callbacks: { redirectUri: "c" } })).toThrow(/baseUrl/);
    expect(() => new HttpSaasAuthClient({ baseUrl: "h", clientId: "", clientSecret: "y", defaultTenantId: "z", callbacks: { redirectUri: "c" } })).toThrow(/clientId/);
    expect(() => new HttpSaasAuthClient({ baseUrl: "h", clientId: "x", clientSecret: "", defaultTenantId: "z", callbacks: { redirectUri: "c" } })).toThrow(/clientSecret/);
    expect(() => new HttpSaasAuthClient({ baseUrl: "h", clientId: "x", clientSecret: "y", defaultTenantId: "", callbacks: { redirectUri: "c" } })).toThrow(/defaultTenantId/);
  });
});

describe("M01.F05.I07 SaasMeClient", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("whoami sends Bearer token", async () => {
    let sentAuth: string | null = null;
    globalThis.fetch = vi.fn(async (_url: string | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      sentAuth = headers.get("authorization");
      return new Response(
        JSON.stringify({ id: "USER-A", email: "admin@lab.local", displayName: "管理员", memberships: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const client = new HttpSaasMeClient("http://saas.local");
    const user = await client.whoami("saas-at-xyz");
    expect(user.id).toBe("USER-A");
    expect(user.email).toBe("admin@lab.local");
    expect(sentAuth).toBe("Bearer saas-at-xyz");
  });

  it("listMyTenants returns array", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify([{ id: "m1", userId: "USER-A", tenantId: "TENANT-001", roleIds: ["admin"], status: "active" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;
    const client = new HttpSaasMeClient("http://saas.local");
    const arr = await client.listMyTenants("saas-at");
    expect(arr).toHaveLength(1);
    expect(arr[0]!.tenantId).toBe("TENANT-001");
  });
});
