// M01.F05.I09 — StateCookieManager (OAuth 2.0 state CSRF 保护, RFC 6749 §10.12)。
//
// cookie value = "<nonce>.<base64url(signature)>.<base64url(payload)>"
//   nonce: 16B random base64url
//   signature: HMAC-SHA256(secret, "<nonce>.<payload>")
//   payload: { nonce, redirect, ts }
//
// 流程:
//   1. /auth/sso/authorize → issue(redirect) → Set-Cookie lab_sso_state + 写 saas ?state=nonce
//   2. 浏览器走 saas → 落回 /auth/sso/callback
//   3. callback 收到 body.state + cookie → verify(cookieValue, bodyState) → 校验
//   4. 失败抛 Error (CSRF suspected / expired / signature mismatch)
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STATE_COOKIE_NAME = "lab_sso_state";
const MAX_AGE_SECONDS = 300;

export interface SignedState {
  readonly nonce: string;
  readonly cookieValue: string;
  readonly ts: number;
}

export interface StatePayload {
  nonce?: string;
  redirect?: string;
  ts?: number;
}

export class StateCookieManager {
  private readonly secret: Buffer;

  constructor(secret: string) {
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("LAB_JWT_SECRET required for StateCookieManager (>=32 bytes)");
    }
    this.secret = Buffer.from(secret, "utf8");
  }

  static get cookieName(): string {
    return STATE_COOKIE_NAME;
  }
  static get maxAgeSeconds(): number {
    return MAX_AGE_SECONDS;
  }

  issue(businessRedirect: string): SignedState {
    const nonce = b64url(randomBytes(16));
    const ts = Math.floor(Date.now() / 1000);
    const payload: StatePayload = {
      nonce,
      redirect: businessRedirect || "",
      ts,
    };
    const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
    const sig = this.hmac(`${nonce}.${payloadB64}`);
    const cookieValue = `${nonce}.${sig}.${payloadB64}`;
    return { nonce, cookieValue, ts };
  }

  /**
   * 校验 cookie + body.state 一对,签名有效,5min 内未过期。
   * @returns business redirect
   */
  verify(cookieValue: string, bodyState: string): string {
    if (!cookieValue) {
      throw new Error("missing lab_sso_state cookie");
    }
    if (!bodyState) {
      throw new Error("missing state in body");
    }
    const parts = cookieValue.split(".");
    if (parts.length !== 3) {
      throw new Error("malformed lab_sso_state cookie");
    }
    const [nonce, signature, payloadB64] = parts as [string, string, string];
    const expectedSig = this.hmac(`${nonce}.${payloadB64}`);
    if (!this.constantTimeEquals(expectedSig, signature)) {
      throw new Error("lab_sso_state signature mismatch");
    }
    if (nonce !== bodyState) {
      throw new Error("state nonce mismatch (CSRF suspected)");
    }
    let sp: StatePayload;
    try {
      sp = JSON.parse(Buffer.from(payloadB64!, "base64url").toString("utf8")) as StatePayload;
    } catch (e) {
      throw new Error(`lab_sso_state payload unparseable: ${(e as Error).message}`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (!sp.ts || now - sp.ts > MAX_AGE_SECONDS) {
      throw new Error("lab_sso_state expired");
    }
    return sp.redirect ?? "";
  }

  private hmac(input: string): string {
    return b64url(createHmac("sha256", this.secret).update(input, "utf8").digest());
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

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
