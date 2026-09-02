// M01.F05.I07/I08 — SaasAuthClient + SaasMeClient (真对接 saas-identity-platform)。
//
// 镜像 springboot / aspnetcore 仓的 SaasAuthClient 语义:
//   POST /api/v1/oauth/authorize  → { code, state }
//   POST /api/v1/oauth/token     → { accessToken, refreshToken, tokenType, expiresIn, scope }
//   GET  /api/v1/me              → { id, email, displayName, memberships, currentTenantId }
//   GET  /api/v1/me/tenants      → TenantMembership[]
//
// 失败映射(与 SpringBoot / aspnetcore 子类对齐):
//   400 → InvalidGrant     401 → UnauthorizedClient     5xx → UpstreamUnavailable
//
// 客户端:接口 + HttpRealClient + NoopClient(profile 切换 dev 不启 saas)。
import { config as loadEnv } from "node:process";

export class SaasAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: "invalid_grant" | "unauthorized_client" | "upstream",
  ) {
    super(message);
  }
}

export interface AuthorizeCodeResponse {
  code: string;
  state: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

export interface SaasCurrentUser {
  id: string;
  email: string;
  displayName?: string;
  memberships?: SaasTenantMembership[];
  currentTenantId?: string;
}

export interface SaasTenantMembership {
  id: string;
  userId: string;
  tenantId: string;
  roleIds: string[];
  status: string;
  joinedAt?: string;
}

export interface SaasAuthClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultTenantId: string;
  callbacks: { redirectUri: string };
}

export interface SaasAuthClient {
  authorize(redirectUri: string, scope: string, state: string): Promise<AuthorizeCodeResponse>;
  token(
    grantType: "authorization_code" | "refresh_token",
    code: string | null,
    refreshToken: string | null,
    redirectUri: string | null,
  ): Promise<TokenResponse>;
}

export interface SaasMeClient {
  whoami(saasAccessToken: string): Promise<SaasCurrentUser>;
  listMyTenants(saasAccessToken: string): Promise<SaasTenantMembership[]>;
}

// === Real HTTP impl ===

export class HttpSaasAuthClient implements SaasAuthClient {
  constructor(private readonly cfg: SaasAuthClientConfig) {
    if (!cfg.baseUrl) throw new Error("HttpSaasAuthClient: baseUrl required");
    if (!cfg.clientId) throw new Error("HttpSaasAuthClient: clientId required");
    if (!cfg.clientSecret) throw new Error("HttpSaasAuthClient: clientSecret required");
    if (!cfg.defaultTenantId) throw new Error("HttpSaasAuthClient: defaultTenantId required");
    if (!cfg.callbacks.redirectUri) throw new Error("HttpSaasAuthClient: redirectUri required");
  }

  async authorize(redirectUri: string, scope: string, state: string): Promise<AuthorizeCodeResponse> {
    const body = {
      clientId: this.cfg.clientId,
      redirectUri,
      responseType: "code",
      scope,
      state,
      tenantId: this.cfg.defaultTenantId,
    };
    const resp = await this.post("/api/v1/oauth/authorize", body);
    return resp as AuthorizeCodeResponse;
  }

  async token(
    grantType: "authorization_code" | "refresh_token",
    code: string | null,
    refreshToken: string | null,
    redirectUri: string | null,
  ): Promise<TokenResponse> {
    const body: Record<string, string> = {
      grantType,
      clientId: this.cfg.clientId,
      clientSecret: this.cfg.clientSecret,
      tenantId: this.cfg.defaultTenantId,
    };
    if (code) body.code = code;
    if (refreshToken) body.refreshToken = refreshToken;
    if (redirectUri) body.redirectUri = redirectUri;
    const resp = await this.post("/api/v1/oauth/token", body);
    return resp as TokenResponse;
  }

  private async post(path: string, body: Record<string, string>): Promise<unknown> {
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}${path}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new SaasAuthError(`saas connect failed: ${(e as Error).message}`, 502, "upstream");
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (resp.status === 401) {
        throw new SaasAuthError("saas 401 unauthorized_client", 401, "unauthorized_client");
      }
      if (resp.status >= 400 && resp.status < 500) {
        throw new SaasAuthError(
          `saas ${resp.status} ${truncated}`,
          400,
          "invalid_grant",
        );
      }
      throw new SaasAuthError(
        `saas ${resp.status} ${truncated}`,
        502,
        "upstream",
      );
    }
    return resp.json();
  }
}

export class HttpSaasMeClient implements SaasMeClient {
  constructor(private readonly baseUrl: string) {
    if (!baseUrl) throw new Error("lab.sso.saas-base required for SaasMeClient");
  }

  async whoami(saasAccessToken: string): Promise<SaasCurrentUser> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/me`;
    const resp = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${saasAccessToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (resp.status >= 500) {
        throw new SaasAuthError(`saas /me ${resp.status} ${truncated}`, 502, "upstream");
      }
      throw new SaasAuthError(`saas /me ${resp.status} ${truncated}`, 400, "invalid_grant");
    }
    return (await resp.json()) as SaasCurrentUser;
  }

  async listMyTenants(saasAccessToken: string): Promise<SaasTenantMembership[]> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/me/tenants`;
    const resp = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${saasAccessToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (resp.status >= 500) {
        throw new SaasAuthError(`saas /me/tenants ${resp.status} ${truncated}`, 502, "upstream");
      }
      throw new SaasAuthError(`saas /me/tenants ${resp.status} ${truncated}`, 400, "invalid_grant");
    }
    return (await resp.json()) as SaasTenantMembership[];
  }
}

// === Noop impl (dev / no-sso profile) ===

export class NoopSaasAuthClient implements SaasAuthClient {
  async authorize(_redirectUri: string, _scope: string, state: string): Promise<AuthorizeCodeResponse> {
    // NoopSaasAuthClient 是 dev 环境替身：authorize 返固定 dev-code，参数被接口签名
    // 强制要求但不在响应里出现。签名同步对齐 SaasAuthClient 接口（M01.F05.I05 契约）。
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
    // NoopSaasAuthClient.token：同上，返固定 dev token 不消费 OAuth grant 字段。
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

export class NoopSaasMeClient implements SaasMeClient {
  async whoami(_saasAccessToken: string): Promise<SaasCurrentUser> {
    // Noop 替身：返固定 USER-A，saasAccessToken 在 dev 环境不参与校验。
    void _saasAccessToken;
    return {
      id: "USER-A",
      // 2026-09-02 契约收敛：与 directory DEMO_USER.username=alice 对齐（refresh 路径
      // findByEmail(email) 必须命中目录行，否则 unknown user）
      email: "alice",
      displayName: "管理员",
      memberships: [
        { id: "m1", userId: "USER-A", tenantId: "TENANT-001", roleIds: ["admin"], status: "active" },
        { id: "m2", userId: "USER-A", tenantId: "TENANT-002", roleIds: ["technician"], status: "active" },
        { id: "m3", userId: "USER-A", tenantId: "TENANT-003", roleIds: ["viewer"], status: "active" },
      ],
    };
  }
  async listMyTenants(_saasAccessToken: string): Promise<SaasTenantMembership[]> {
    void _saasAccessToken;
    return [
      { id: "m1", userId: "USER-A", tenantId: "TENANT-001", roleIds: ["admin"], status: "active" },
      { id: "m2", userId: "USER-A", tenantId: "TENANT-002", roleIds: ["technician"], status: "active" },
      { id: "m3", userId: "USER-A", tenantId: "TENANT-003", roleIds: ["viewer"], status: "active" },
    ];
  }
}

// === Client factory (LabConfig 决定 inline) ===

export interface SaasConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultTenantId: string;
  callbackRedirectUri: string;
  profile: "no-sso" | "real";
}

export function createSaasAuthClient(cfg: SaasConfig): SaasAuthClient {
  if (cfg.profile === "no-sso") return new NoopSaasAuthClient();
  return new HttpSaasAuthClient({
    baseUrl: cfg.baseUrl,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    defaultTenantId: cfg.defaultTenantId,
    callbacks: { redirectUri: cfg.callbackRedirectUri },
  });
}

export function createSaasMeClient(cfg: SaasConfig): SaasMeClient {
  if (cfg.profile === "no-sso") return new NoopSaasMeClient();
  return new HttpSaasMeClient(cfg.baseUrl);
}

// 抑制 unused warning:process 已在 import {config} 模式
void loadEnv;
