// M01.F05.I06 — AuthService factory。从 env vars 装配 (per ADR-0008)。
//
// 2026-09-20 人裁：lab 家族不再支持 no-sso / memory provider 模式——恒 real SSO
// 链路（HttpSaasAuthClient / HttpSaasMeClient，4 个 saas env 由构造器逐项 fail-fast）。
// LAB_SSO_PROFILE key 随模式退役删除（家族 env 契约同批收敛）。
import { LabJwtSigner } from "./jwt";
import {
  SaasAuthClient,
  SaasMeClient,
  createSaasAuthClient,
  createSaasMeClient,
  SaasConfig,
} from "./saas";
import { StateCookieManager } from "./state-cookie";
import { ConfigUserDirectory, IUserDirectory } from "./directory";
import { AuthService } from "./config";

export interface LabConfig {
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
  // CLAUDE.md §2 禁 env 默认值兜底（2026-09-15 存量违规修复）：以下 5 键缺失即
  // throw——deploy lab.env 自举 + 四份 env 契约早已覆盖，静默吃 dev 字面量只会
  // 掩盖配置漂移（param 形式 `env.X ?? "..."` 曾绕过 L0.no_fallback 的
  // process.env 正则，是门禁盲区；tests/lib/auth/factory.test.ts 源码锁防回归）。
  // 惰性求值：本函数只在 route handler 请求期被调，next build 的
  // "Collecting page data" 不会踩到（勿提升到模块作用域）。
  return {
    jwt: {
      issuer: requireKey(env, "LAB_JWT_ISSUER"),
      secret: requireKey(env, "LAB_JWT_SECRET"),
      ttlSeconds: parseInt(requireKey(env, "LAB_JWT_TTL_SECONDS"), 10),
      refreshTtlSeconds: parseInt(requireKey(env, "LAB_JWT_REFRESH_TTL_SECONDS"), 10),
    },
    // LAB_SAAS_* 组不 require：由 HttpSaasAuthClient / HttpSaasMeClient
    // 构造器逐项 fail-fast（saas.ts），空 ≠ 静默兜底（显式空串语义见
    // env-required.ts）。
    sso: {
      saasBaseUrl: env.LAB_SAAS_BASE ?? "",
      clientId: env.LAB_SAAS_CLIENT_ID ?? "",
      clientSecret: env.LAB_SAAS_CLIENT_SECRET ?? "",
      defaultTenantId: env.LAB_SAAS_DEFAULT_TENANT_ID ?? "",
      callbackRedirectUri: env.LAB_SSO_CALLBACK_REDIRECT ?? "",
    },
    auth: {
      devPassword: requireKey(env, "LAB_AUTH_DEV_PASSWORD"),
    },
  };
}

function requireKey(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (v === undefined) {
    throw new Error(
      `${name} env is required（CLAUDE.md §2 禁 env 默认值兜底）。` +
        ` dev=.env.local / test=tests/setup.ts seed / prod=deploy lab.env。`,
    );
  }
  return v;
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
    baseUrl: cfg.sso.saasBaseUrl,
    clientId: cfg.sso.clientId,
    clientSecret: cfg.sso.clientSecret,
    defaultTenantId: cfg.sso.defaultTenantId,
    callbackRedirectUri: cfg.sso.callbackRedirectUri,
  };
}
