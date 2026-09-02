// M01.F05.I06/I07/I08 — AuthService 集成测试。
//
// 全部走 NoopSaasAuthClient / NoopSaasMeClient(无需 saas 联通)。
// 覆盖 login / refresh / ssoAuthorize / ssoCallback / me / switchTenant。
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LabJwtSigner } from "@/lib/auth/jwt";
import { NoopSaasAuthClient, NoopSaasMeClient } from "@/lib/auth/saas";
import { StateCookieManager } from "@/lib/auth/state-cookie";
import { ConfigUserDirectory } from "@/lib/auth/directory";
import { AuthService } from "@/lib/auth/config";

const SECRET = "test-lab-jwt-secret-test-lab-jwt-secret-test-lab-jwt-secret";
const JWT = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
const STCOOKIE = new StateCookieManager(SECRET);
const DIR = new ConfigUserDirectory("dev123456");
const SVC = new AuthService(
  DIR,
  JWT,
  new NoopSaasAuthClient(),
  new NoopSaasMeClient(),
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
    await expect(SVC.ssoCallback(body, auth.cookieValue)).rejects.toThrow(/nonce mismatch/);
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
    expect(() => SVC.switchTenant({ sub: "USER-A" }, "TENANT-999")).toThrow(/Tenant not found/);
  });

  it("permissions returns admin full set", () => {
    const perms = SVC.permissions();
    expect(perms).toHaveLength(11);
    expect(perms).toContain("*");
  });
});
