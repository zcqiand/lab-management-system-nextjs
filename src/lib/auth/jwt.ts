// M01.F05.I06 — LabJwtSigner (Node 版本, HMAC HS256 自签 JWT)。
//
// 镜像 springboot / aspnetcore 仓的 LabJwtSigner 语义:
// - 三段: base64url(header).base64url(payload).base64url(HMAC-SHA256)
// - 头 alg 固定 HS256 (不允许 alg=none)
// - claim { sub, iat, exp, typ, iss, tenant_id? }
// - refresh token 嵌 saas_refresh_token claim
// - verify 同步恒等 + iss + exp 校验
//
// 使用 node:crypto (Node 18+ 内置),不引第三方 lib (jose / jsonwebtoken)。
import { createHmac, timingSafeEqual } from "node:crypto";

const ALG = "HS256";
const TYP_ACCESS = "access";
const TYP_REFRESH = "refresh";
const HEADER_JSON = `{"alg":"${ALG}","typ":"JWT"}`;
const MIN_SECRET_BYTES = 32;

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  typ: string;
  iss: string;
  tenant_id?: string;
  saas_refresh_token?: string;
  [claim: string]: unknown;
}

export class LabJwtSigner {
  private readonly secret: Buffer;
  private readonly issuer: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    secret: string,
    issuer: string,
    accessTtlSeconds: number,
    refreshTtlSeconds: number,
  ) {
    if (!secret) {
      throw new Error("LAB_JWT_SECRET required (>=32 bytes). Set via env var or config.");
    }
    if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
      throw new Error(
        `LAB_JWT_SECRET must be >=${MIN_SECRET_BYTES} bytes (got ${Buffer.byteLength(secret, "utf8")}). Use openssl rand -base64 48.`,
      );
    }
    if (!issuer) {
      throw new Error("lab.jwt.issuer required");
    }
    this.secret = Buffer.from(secret, "utf8");
    this.issuer = issuer;
    this.accessTtlSeconds = accessTtlSeconds;
    this.refreshTtlSeconds = refreshTtlSeconds;
  }

  /** Access token。tenantId 可空。 */
  issue(userId: string, tenantId: string | null): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: JwtClaims = {
      sub: userId,
      iat: now,
      exp: now + this.accessTtlSeconds,
      typ: TYP_ACCESS,
      iss: this.issuer,
    };
    if (tenantId) claims.tenant_id = tenantId;
    return this.sign(claims);
  }

  /** Refresh token。载荷嵌 saas_refresh_token,lab 后端无 DB 持久化。 */
  issueRefresh(userId: string, saasRefreshToken: string): string {
    if (!saasRefreshToken) {
      throw new Error("saasRefreshToken required for refresh token");
    }
    const now = Math.floor(Date.now() / 1000);
    const claims: JwtClaims = {
      sub: userId,
      saas_refresh_token: saasRefreshToken,
      iat: now,
      exp: now + this.refreshTtlSeconds,
      typ: TYP_REFRESH,
      iss: this.issuer,
    };
    return this.sign(claims);
  }

  /** 同步 HMAC 验签 + iss + exp 校验。失败抛 Error。 */
  verify(token: string): JwtClaims {
    if (!token) {
      throw new Error("token is empty");
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error(`malformed JWT: expected 3 segments, got ${parts.length}`);
    }
    const signingInput = `${parts[0]!}.${parts[1]!}`;
    const expectedSig = this.hmacBase64Url(signingInput);
    if (!this.constantTimeEquals(expectedSig, parts[2]!)) {
      throw new Error("bad signature");
    }
    let claims: JwtClaims;
    try {
      const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
      claims = JSON.parse(json) as JwtClaims;
    } catch (e) {
      throw new Error(`invalid payload: ${(e as Error).message}`);
    }
    if (claims.iss !== this.issuer) {
      throw new Error(`bad issuer: ${claims.iss}`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === "number" && claims.exp < now) {
      throw new Error("token expired");
    }
    return claims;
  }

  private sign(claims: JwtClaims): string {
    const header = b64url(Buffer.from(HEADER_JSON, "utf8"));
    // 字典序输出,保证后端判定一致
    const sortedKeys = Object.keys(claims).sort();
    const obj: Record<string, unknown> = {};
    for (const k of sortedKeys) obj[k] = claims[k];
    const payload = b64url(Buffer.from(JSON.stringify(obj), "utf8"));
    const signingInput = `${header}.${payload}`;
    return `${signingInput}.${this.hmacBase64Url(signingInput)}`;
  }

  private hmacBase64Url(input: string): string {
    const sig = createHmac("sha256", this.secret).update(input, "utf8").digest();
    return b64url(sig);
  }

  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
    } catch {
      return false;
    }
  }
}

function b64url(data: Buffer): string {
  return data.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
