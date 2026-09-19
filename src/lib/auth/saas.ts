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
// 客户端:接口 + Http 实现（2026-09-20 人裁：no-sso/Noop 模式已退役，恒真链路）。
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

// === Client factory (LabConfig 决定 inline) ===
// 2026-09-20 起 no-sso 分支已删：恒 Http 实现，构造器逐项 fail-fast。

export interface SaasConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultTenantId: string;
  callbackRedirectUri: string;
}

export function createSaasAuthClient(cfg: SaasConfig): SaasAuthClient {
  return new HttpSaasAuthClient({
    baseUrl: cfg.baseUrl,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    defaultTenantId: cfg.defaultTenantId,
    callbacks: { redirectUri: cfg.callbackRedirectUri },
  });
}

export function createSaasMeClient(cfg: SaasConfig): SaasMeClient {
  return new HttpSaasMeClient(cfg.baseUrl);
}

// 抑制 unused warning:process 已在 import {config} 模式
void loadEnv;
