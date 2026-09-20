// M01.F05.I06/I07/I08 — AuthService 集成测试。
//
// 全部走本文件内联的 StubSaasAuthClient / StubSaasMeClient(无需 saas 联通)。
// NoopSaas* 原是 src/lib/auth/saas.ts 的 dev 模式替身，随 no-sso 模式退役
// （2026-09-20 人裁）从 src 删除——测试替身就地内联，签名/返回值与原 src 版
// 逐字对齐（dev-code / dev-refresh-token / USER-A 三租户），AuthService 的
// refresh 嵌入与 ssoCallback 断言依赖这些字面值。
// 覆盖 login / refresh / ssoAuthorize / ssoCallback / me / switchTenant。
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LabJwtSigner } from "@/lib/auth/jwt";
import {
  AuthorizeCodeResponse,
  SaasAuthClient,
  SaasCurrentUser,
  SaasMeClient,
  SaasTenantMembership,
  TokenResponse,
} from "@/lib/auth/saas";
import { StateCookieManager } from "@/lib/auth/state-cookie";
import { ConfigUserDirectory } from "@/lib/auth/directory";
import { AuthService } from "@/lib/auth/config";

class StubSaasAuthClient implements SaasAuthClient {
  async authorize(
    _redirectUri: string,
    _scope: string,
    state: string,
  ): Promise<AuthorizeCodeResponse> {
    // authorize 返固定 dev-code，参数被接口签名强制要求但不在响应里出现。
    void _redirectUri;
    void _scope;
    return { code: "dev-code", state };
  }
  async token(
    _grantType: "authorization_code" | "refresh_token",
    _code: string | null,
    _refreshToken: string | null,
    _redirectUri: string | null,
  ): Promise<TokenResponse> {
    // 返固定 dev token 不消费 OAuth grant 字段。
    void _grantType;
    void _code;
    void _refreshToken;
    void _redirectUri;
    return {
      accessToken: "dev-access-token",
      refreshToken: "dev-refresh-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: "openid",
    };
  }
}

class StubSaasMeClient implements SaasMeClient {
  async whoami(_saasAccessToken: string): Promise<SaasCurrentUser> {
    // 返固定 USER-A，saasAccessToken 不参与校验。
    void _saasAccessToken;
    return {
      id: "USER-A",
      // 与 directory DEMO_USER.username=alice 对齐（refresh 路径
      // findByEmail(email) 必须命中目录行，否则 unknown user）
      email: "alice",
      displayName: "管理员",
      memberships: [
        {
          id: "m1",
          userId: "USER-A",
          tenantId: "TENANT-001",
          roleIds: ["admin"],
          status: "active",
        },
        {
          id: "m2",
          userId: "USER-A",
          tenantId: "TENANT-002",
          roleIds: ["technician"],
          status: "active",
        },
        {
          id: "m3",
          userId: "USER-A",
          tenantId: "TENANT-003",
          roleIds: ["viewer"],
          status: "active",
        },
      ],
    };
  }
  async listMyTenants(_saasAccessToken: string): Promise<SaasTenantMembership[]> {
    void _saasAccessToken;
    return [
      {
        id: "m1",
        userId: "USER-A",
        tenantId: "TENANT-001",
        roleIds: ["admin"],
        status: "active",
      },
      {
        id: "m2",
        userId: "USER-A",
        tenantId: "TENANT-002",
        roleIds: ["technician"],
        status: "active",
      },
      {
        id: "m3",
        userId: "USER-A",
        tenantId: "TENANT-003",
        roleIds: ["viewer"],
        status: "active",
      },
    ];
  }
}

const SECRET = "test-lab-jwt-secret-test-lab-jwt-secret-test-lab-jwt-secret";
const JWT = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
const STCOOKIE = new StateCookieManager(SECRET);
const DIR = new ConfigUserDirectory("dev123456");
const SVC = new AuthService(
  DIR,
  JWT,
  new StubSaasAuthClient(),
  new StubSaasMeClient(),
  STCOOKIE,
  "http://lab.local/api/auth/sso/callback",
);

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("M01.F05 AuthService", () => {
  it("login success returns session with 3 tenants", () => {
    const resp = SVC.login("alice", "dev123456");
    expect(resp.user.id).toBe("USER-A");
    expect(resp.tenants).toHaveLength(3);
    expect(resp.token).toBeTruthy();
    expect(resp.refreshToken).toBeTruthy();
  });

  it("login wrong password throws", () => {
    expect(() => SVC.login("alice", "wrong")).toThrow(/Invalid/);
  });

  it("login blank fields throws", () => {
    expect(() => SVC.login("", "")).toThrow(/required/);
  });

  it("refresh round trip with embedded saas_refresh_token", async () => {
    const refreshToken = JWT.issueRefresh("USER-A", "saas-rt-new");
    const resp = await SVC.refresh(refreshToken);
    expect(resp.user.id).toBe("USER-A");
    expect(resp.token).toBeTruthy();
  });

  it("refresh malformed token throws", async () => {
    await expect(SVC.refresh("junk")).rejects.toThrow(/invalid refresh_token/);
  });

  it("ssoAuthorize returns authorizeUrl + state", () => {
    // ssoAuthorize 用真 saas 链路需要 baseUrl
    return SVC.ssoAuthorize("/dashboard", "http://saas.local").then((res) => {
      expect(res.redirect.authorizeUrl).toContain("http://saas.local/login");
      expect(res.redirect.state).toBeTruthy();
      expect(res.cookieValue).toBeTruthy();
    });
  });

  it("ssoCallback returns demo session with embedded saas_refresh_token", async () => {
    const auth = await SVC.ssoAuthorize("/dashboard", "http://saas.local");
    const body = {
      code: "dev-code",
      redirect_uri: "http://lab.local/api/auth/sso/callback",
      state: auth.redirect.state,
    };
    const resp = await SVC.ssoCallback(body, auth.cookieValue);
    expect(resp.user.id).toBe("USER-A");
    expect(resp.tenants).toHaveLength(3);
    // refresh token 嵌 saas_refresh_token
    const refreshPayload = JSON.parse(
      Buffer.from(resp.refreshToken.split(".")[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(refreshPayload.saas_refresh_token).toBe("dev-refresh-token");
  });

  it("ssoCallback mismatched state throws", async () => {
    const auth = await SVC.ssoAuthorize("/dashboard", "http://saas.local");
    const body = {
      code: "dev-code",
      redirect_uri: "http://lab.local/api/auth/sso/callback",
      state: "forged-state",
    };
    await expect(SVC.ssoCallback(body, auth.cookieValue)).rejects.toThrow(
      /nonce mismatch/,
    );
  });

  it("me with no JWT claims defaults to first tenant", () => {
    const session = SVC.me({ sub: "USER-A" });
    expect(session.currentTenantId).toBe("TENANT-001");
    expect(session.user.id).toBe("USER-A");
  });

  it("me with tenant_id claim respects claim", () => {
    const session = SVC.me({ sub: "USER-A", tenant_id: "TENANT-002" });
    expect(session.currentTenantId).toBe("TENANT-002");
  });

  it("switchTenant issues token with tenant_id claim", () => {
    const resp = SVC.switchTenant({ sub: "USER-A" }, "TENANT-003");
    expect(resp.token).toBeTruthy();
    const claims = JWT.verify(resp.token);
    expect(claims.tenant_id).toBe("TENANT-003");
  });

  it("switchTenant unknown tenant throws", () => {
    expect(() => SVC.switchTenant({ sub: "USER-A" }, "TENANT-999")).toThrow(
      /Tenant not found/,
    );
  });

  it("permissions returns admin full set", () => {
    const perms = SVC.permissions();
    expect(perms).toHaveLength(11);
    expect(perms).toContain("*");
  });
});
