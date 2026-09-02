// M01.F05.I06 — AuthService factory。从 env vars 装配 (per ADR-0008)。
//
// dev profile=no-sso 走 NoopSaasAuthClient / NoopSaasMeClient;
// profile=real 走 HttpSaasAuthClient / HttpSaasMeClient(需 4 个 saas env 必填)。
import { LabJwtSigner } from "./jwt";
import { SaasAuthClient, SaasMeClient, createSaasAuthClient, createSaasMeClient, SaasConfig } from "./saas";
import { StateCookieManager } from "./state-cookie";
import { ConfigUserDirectory, IUserDirectory } from "./directory";
import { AuthService } from "./config";

export interface LabConfig {
  profile: "no-sso" | "real";
  jwt: {
    issuer: string;
    secret: string;
    ttlSeconds: number;
    refreshTtlSeconds: number;
  };
  sso: {
    saasBaseUrl: string;
    clientId: string;
    clientSecret: string;
    defaultTenantId: string;
    callbackRedirectUri: string;
  };
  auth: {
    devPassword: string;
  };
}

export function readLabConfig(env: NodeJS.ProcessEnv = process.env): LabConfig {
  const profile = (env.LAB_SSO_PROFILE ?? "no-sso") as "no-sso" | "real";
  const secret =
    env.LAB_JWT_SECRET ?? "dev-lab-jwt-secret-dev-lab-jwt-secret-dev-lab-jwt-secret";
  return {
    profile,
    jwt: {
      issuer: env.LAB_JWT_ISSUER ?? "lab-management-system",
      secret,
      ttlSeconds: parseInt(env.LAB_JWT_TTL_SECONDS ?? "3600", 10),
      refreshTtlSeconds: parseInt(env.LAB_JWT_REFRESH_TTL_SECONDS ?? "604800", 10),
    },
    sso: {
      saasBaseUrl: env.LAB_SAAS_BASE ?? "http://localhost:5101",
      clientId: env.LAB_SAAS_CLIENT_ID ?? "",
      clientSecret: env.LAB_SAAS_CLIENT_SECRET ?? "",
      defaultTenantId: env.LAB_SAAS_DEFAULT_TENANT_ID ?? "",
      callbackRedirectUri:
        env.LAB_SSO_CALLBACK_REDIRECT ?? "http://localhost:5201/api/auth/sso/callback",
    },
    auth: {
      devPassword: env.LAB_AUTH_DEV_PASSWORD ?? "dev123456",
    },
  };
}

export interface BuiltAuth {
  service: AuthService;
  directory: IUserDirectory;
  config: LabConfig;
}

export function buildAuth(env: NodeJS.ProcessEnv = process.env): BuiltAuth {
  const cfg = readLabConfig(env);
  const jwt = new LabJwtSigner(
    cfg.jwt.secret,
    cfg.jwt.issuer,
    cfg.jwt.ttlSeconds,
    cfg.jwt.refreshTtlSeconds,
  );
  const stateMgr = new StateCookieManager(cfg.jwt.secret);
  const directory = new ConfigUserDirectory(cfg.auth.devPassword);
  const ssoAuth: SaasAuthClient = createSaasAuthClient(toSaasConfig(cfg));
  const ssoMe: SaasMeClient = createSaasMeClient(toSaasConfig(cfg));
  const service = new AuthService(
    directory,
    jwt,
    ssoAuth,
    ssoMe,
    stateMgr,
    cfg.sso.callbackRedirectUri,
  );
  return { service, directory, config: cfg };
}

function toSaasConfig(cfg: LabConfig): SaasConfig {
  return {
    profile: cfg.profile,
    baseUrl: cfg.sso.saasBaseUrl,
    clientId: cfg.sso.clientId,
    clientSecret: cfg.sso.clientSecret,
    defaultTenantId: cfg.sso.defaultTenantId,
    callbackRedirectUri: cfg.sso.callbackRedirectUri,
  };
}
