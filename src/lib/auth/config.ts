// M01.F05.I06/I07/I08/I09 — AuthService (Node 版,镜像 springboot / aspnetcore)。
//
// 5 端点:
//   login()        : directory.checkPassword → session(user, tenantId, saasRefresh=null)
//   refresh()      : jwt.verify(refresh token) → 取 saas_refresh_token → ssoAuth.token(grantType=refresh_token)
//                    → ssoMe.whoami + listMyTenants → directory.findByEmail → session(user, tenantId, saasRefresh)
//   ssoAuthorize() : stateMgr.issue(redirect) → ssoAuth.authorize → SsoRedirect
//   ssoCallback()  : stateMgr.verify(cookie, body.state) → ssoAuth.token(authorization_code, code, null, redirectUri)
//                    → ssoMe.whoami + listMyTenants → directory.findByEmail or upsert → session(user, null, saasRefresh)
//   me() / switchTenant() : jwt.verify 路径 + directory lookup
//
// session() 签 access + refresh token,嵌 saas refresh token 进 refresh。
import { LabJwtSigner, JwtClaims } from "./jwt";
import {
  AuthorizeCodeResponse,
  SaasAuthClient,
  SaasMeClient,
  SaasTenantMembership,
  TokenResponse,
} from "./saas";
import { StateCookieManager, SignedState } from "./state-cookie";
import { IUserDirectory, LabTenant, LabUser } from "./directory";

export interface CurrentUserView {
  id: string;
  username: string;
  displayName?: string;
  roleCode?: string;
}

export interface TenantView {
  tenantId: string;
  code: string;
  name: string;
  roleIds: string[];
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: CurrentUserView;
  tenants: TenantView[];
}

export interface CurrentUserSession {
  user: CurrentUserView;
  tenants: TenantView[];
  currentTenantId?: string;
}

export interface SsoRedirectView {
  authorizeUrl: string;
  state: string;
}

export const DEMO_PERMISSIONS: string[] = [
  "contract:read",
  "contract:write",
  "sample:read",
  "sample:write",
  "report:read",
  "report:write",
  "report:issue",
  "inspection:read",
  "inspection:write",
  "audit:read",
  "*",
];

export class SsoAuthResult {
  constructor(
    public readonly redirect: SsoRedirectView,
    public readonly cookieValue: string,
  ) {}
}

export class AuthService {
  constructor(
    private readonly directory: IUserDirectory,
    private readonly jwt: LabJwtSigner,
    private readonly ssoAuth: SaasAuthClient,
    private readonly ssoMe: SaasMeClient,
    private readonly stateMgr: StateCookieManager,
    private readonly callbackRedirectUri: string,
  ) {}

  /** 暴露 LabJwtSigner 给 helpers(读/verify 已有 token,不改业务)。 */
  getJwt(): LabJwtSigner {
    return this.jwt;
  }

  /** 暴露 StateCookieManager 给 SSO 路由(写/验 cookie)。 */
  getStateCookieManager(): StateCookieManager {
    return this.stateMgr;
  }

  /** 暴露 ssoAuth 给路由(authorize 路径)。 */
  getSsoAuth(): SaasAuthClient {
    return this.ssoAuth;
  }

  // === M01.F05.I01 密码登录 ===

  login(username: string, password: string): LoginResponse {
    if (!username || !password) {
      throw new Error("username and password are required");
    }
    if (!this.directory.checkPassword(username, password)) {
      throw new Error("Invalid username or password");
    }
    const user = this.directory.findByUsername(username);
    if (!user) throw new Error("Invalid username or password");
    return this.session(user, null, []);
  }

  // === M01.F05.I08 refresh (走 saas grantType=refresh_token) ===

  async refresh(refreshToken: string): Promise<LoginResponse> {
    if (!refreshToken) {
      throw new Error("missing refresh_token");
    }
    let claims: JwtClaims;
    try {
      claims = this.jwt.verify(refreshToken);
    } catch (e) {
      throw new Error(`invalid refresh_token: ${(e as Error).message}`);
    }
    if (claims.typ !== "refresh") {
      throw new Error("invalid refresh_token: not a refresh token");
    }
    const tenantId = (claims.tenant_id as string) ?? null;
    const saasRefresh = claims.saas_refresh_token as string;
    if (!saasRefresh) {
      throw new Error("invalid refresh_token: missing saas_refresh_token claim");
    }
    const t = await this.ssoAuth.token("refresh_token", null, saasRefresh, null);
    const saasUser = await this.ssoMe.whoami(t.accessToken);
    const memberships = await this.ssoMe.listMyTenants(t.accessToken);
    const user = this.directory.findByEmail(saasUser.email);
    if (!user) throw new Error("unknown user");
    return this.session(user, tenantId, memberships, t.refreshToken);
  }

  // === M01.F05.I07 SSO 跳转 ===

  async ssoAuthorize(
    businessRedirect: string,
    saasBaseUrl: string,
  ): Promise<SsoAuthResult> {
    const target = businessRedirect || "/";
    const ss: SignedState = this.stateMgr.issue(target);
    const resp: AuthorizeCodeResponse = await this.ssoAuth.authorize(
      this.callbackRedirectUri,
      "openid profile email",
      ss.nonce,
    );
    // 浏览器跳 saas 登录页(带 code + state + redirect_uri 三参数)
    const baseUrl = saasBaseUrl.replace(/\/$/, "");
    const redirectUri = encodeURIComponent(this.callbackRedirectUri);
    const authorizeUrl = `${baseUrl}/login?code=${resp.code}&state=${resp.state}&redirect_uri=${redirectUri}`;
    return new SsoAuthResult({ authorizeUrl, state: ss.nonce }, ss.cookieValue);
  }

  // === M01.F05.I07 SSO 回调 ===

  async ssoCallback(
    body: { code: string; redirect_uri?: string; state: string },
    cookieValue: string,
  ): Promise<LoginResponse> {
    if (!body?.code || !body?.state) {
      throw new Error("code and state are required");
    }
    this.stateMgr.verify(cookieValue, body.state);
    const redirectUri = body.redirect_uri ?? this.callbackRedirectUri;
    const t: TokenResponse = await this.ssoAuth.token(
      "authorization_code",
      body.code,
      null,
      redirectUri,
    );
    const saasUser = await this.ssoMe.whoami(t.accessToken);
    const memberships = await this.ssoMe.listMyTenants(t.accessToken);
    const user =
      this.directory.findByEmail(saasUser.email) ??
      this.directory.upsert(
        saasUser.id,
        saasUser.email,
        saasUser.displayName ?? "",
        "viewer",
      );
    return this.session(user, null, memberships, t.refreshToken);
  }

  // === M00.F01 当前会话 ===

  me(claims: Record<string, unknown>): CurrentUserSession {
    const user = this.resolveUser(claims);
    const currentTenantId = (claims.tenant_id as string) ?? this.directory.defaultTenant().tenantId;
    return {
      user: this.toUserView(user),
      tenants: this.directory.tenantsOf(user.username),
      currentTenantId,
    };
  }

  // === M00.F02 选租户换发 ===

  switchTenant(claims: Record<string, unknown>, tenantId: string): LoginResponse {
    const user = this.resolveUser(claims);
    const target = this.directory.findByTenantId(tenantId);
    if (!target) throw new Error("Tenant not found");
    return this.session(user, target.tenantId, []);
  }

  // === M01.F04.I02 权限集 / I01 菜单 ===

  permissions(): string[] {
    return [...DEMO_PERMISSIONS];
  }

  // === helpers ===

  private resolveUser(claims: Record<string, unknown>): LabUser {
    const sub = claims.sub as string;
    if (!sub) throw new Error("missing sub claim");
    return (
      this.directory.findById(sub) ??
      this.directory.findByEmail(sub) ??
      this.directory.findByUsername(sub) ??
      (() => {
        throw new Error(`unknown user: ${sub}`);
      })()
    );
  }

  private session(
    user: LabUser,
    tenantId: string | null,
    explicitTenants: SaasTenantMembership[] | LabTenant[],
    saasRefresh?: string,
  ): LoginResponse {
    const accessToken = this.jwt.issue(user.id, tenantId);
    const refreshToken = this.jwt.issueRefresh(
      user.id,
      saasRefresh ?? "dev-placeholder",
    );
    const tenants: TenantView[] =
      explicitTenants.length > 0 && "tenantId" in explicitTenants[0]!
        ? (explicitTenants as LabTenant[]).map((t) => ({
            tenantId: t.tenantId,
            code: t.code,
            name: t.name,
            roleIds: t.roleIds,
          }))
        : (explicitTenants as SaasTenantMembership[]).map((m) => ({
            tenantId: m.tenantId,
            code: m.tenantId,
            name: m.tenantId,
            roleIds: m.roleIds,
          }));
    if (tenants.length === 0) {
      tenants.push(...this.directory.tenantsOf(user.username));
    }
    return {
      token: accessToken,
      refreshToken,
      user: this.toUserView(user),
      tenants,
    };
  }

  private toUserView(user: LabUser): CurrentUserView {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roleCode: user.roleCode,
    };
  }
}
