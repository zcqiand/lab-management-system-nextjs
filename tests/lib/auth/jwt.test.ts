// M01.F05.I06 — LabJwtSigner 单测（HMAC HS256 真签发/验证）。
//
// 覆盖：
// - access token 签发 → 三段 base64url → 解出 HS256 header + sub/typ/iss/exp claim
// - refresh token 签发（typ=refresh, saas_refresh_token claim 内嵌）
// - 篡改 payload 验签失败
// - 篡改 signature 验签失败
// - 缺 / 弱 LAB_JWT_SECRET 构造抛 Error
import { describe, expect, it } from "vitest";

import { LabJwtSigner } from "@/lib/auth/jwt";

const SECRET = "test-lab-jwt-secret-test-lab-jwt-secret-test-lab-jwt-secret"; // ≥32B

describe("M01.F05.I06 LabJwtSigner", () => {
  it("issue access token signed with HS256", () => {
    const signer = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
    const token = signer.issue("USER-A", "TENANT-002");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(payload.sub).toBe("USER-A");
    expect(payload.tenant_id).toBe("TENANT-002");
    expect(payload.typ).toBe("access");
    expect(payload.iss).toBe("lab-test");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
  });

  it("verify decodes valid access token", () => {
    const signer = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
    const token = signer.issue("USER-A", null);
    const claims = signer.verify(token);
    expect(claims.sub).toBe("USER-A");
    expect(claims.typ).toBe("access");
  });

  it("issueRefresh embeds saas_refresh_token", () => {
    const signer = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
    const token = signer.issueRefresh("USER-A", "saas-rt-xyz");
    const claims = signer.verify(token);
    expect(claims.typ).toBe("refresh");
    expect(claims.saas_refresh_token).toBe("saas-rt-xyz");
  });

  it("tampered payload: signature mismatch rejected", () => {
    const signer = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
    const token = signer.issue("USER-A", null);
    const parts = token.split(".");
    const tampered = parts[0] + "." + parts[1]!.slice(0, -1) + "X" + "." + parts[2]!;
    expect(() => signer.verify(tampered)).toThrow();
  });

  it("tampered signature: rejected", () => {
    const signer = new LabJwtSigner(SECRET, "lab-test", 3600, 604800);
    const token = signer.issue("USER-A", null);
    const parts = token.split(".");
    const tampered = parts[0] + "." + parts[1] + "." + "AAAA";
    expect(() => signer.verify(tampered)).toThrow();
  });

  it("missing LAB_JWT_SECRET throws at construction", () => {
    expect(() => new LabJwtSigner("", "lab-test", 3600, 604800)).toThrow(/LAB_JWT_SECRET/);
  });

  it("too short LAB_JWT_SECRET throws at construction", () => {
    expect(() => new LabJwtSigner("short", "lab-test", 3600, 604800)).toThrow(/>=32/);
  });
});
