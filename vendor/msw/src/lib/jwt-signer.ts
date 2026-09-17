// jwt-signer.ts — lab-msw 真签 HS256 access token (Phase 1B v0.4.0)
//
// 镜像 saas-identity-platform-msw/src/lib/jwt-signer.ts。lab 是单租户：
// tenant_id claim 用 modules 作用域的 currentTenantId（与 /auth/switch-tenant
// handler 共享同一变量；M00.F02.I03 切换当前租户后会重新签 token）。
//
// 与 lab-management-system-{springboot,aspnetcore} 共享 JWT_SIGNING_KEY (env)，
// MSW 签出来的 token 在真后端 dev profile 也能用 NimbusJwtDecoder / jose 验签
// 通过——不再需要 DevJwtDecoder / RequireSignedTokens=false 兜底。

import { SignJWT } from "jose";

const enc = new TextEncoder();

// ADR-0019 禁 env 字面默认值。signing key 缺失 throw（与 issuer/audience 同款 fail-fast）。
export function getSigningKey(): Uint8Array {
  const k = process.env.JWT_SIGNING_KEY;
  if (!k || k.length < 32) {
    throw new Error(
      "JWT_SIGNING_KEY env is missing or shorter than 32 bytes. Set in .env.example / .env.test.",
    );
  }
  return enc.encode(k);
}

// ADR-0019 禁 env 字面默认值。issuer/audience 缺失 throw,handler 启动即拒。
export function getIssuer(): string {
  const v = process.env.JWT_ISSUER;
  if (!v) throw new Error("JWT_ISSUER env is required (ADR-0019 禁字面默认值)");
  return v;
}

export function getAudience(): string {
  const v = process.env.JWT_AUDIENCE;
  if (!v) throw new Error("JWT_AUDIENCE env is required (ADR-0019 禁字面默认值)");
  return v;
}

function getTtlSeconds(): number {
  const raw = process.env.JWT_TTL_SECONDS;
  if (!raw) throw new Error("JWT_TTL_SECONDS env is required (ADR-0019 禁字面默认值)");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`JWT_TTL_SECONDS 非法值 ${raw}（必须正整数）`);
  }
  return n;
}

export async function signAccessToken(claims: {
  sub: string;
  tenant_id: string;
  scope?: string;
  ttlSeconds?: number;
}): Promise<string> {
  const ttl = claims.ttlSeconds ?? getTtlSeconds();
  return await new SignJWT({
    ...(claims.scope ? { scope: claims.scope } : {}),
    tenant_id: claims.tenant_id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setSubject(claims.sub)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${ttl}s`)
    .sign(getSigningKey());
}