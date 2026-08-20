// M01.F05.I09 — StateCookieManager 单测（OAuth state HS256 签发/校验）。
//
// 覆盖：
// - issue → verify（business redirect 还原）
// - body.state 与 cookie nonce 不一致 → 抛（CSRF）
// - 篡改 signature → 抛
// - cookie 缺失 / body 缺失 → 抛
import { describe, expect, it } from "vitest";

import { StateCookieManager } from "@/lib/auth/state-cookie";

const SECRET = "test-lab-jwt-secret-test-lab-jwt-secret-test-lab-jwt-secret";

describe("M01.F05.I09 StateCookieManager", () => {
  const mgr = new StateCookieManager(SECRET);

  it("issueAndVerify restores business redirect", () => {
    const ss = mgr.issue("/dashboard");
    expect(ss.cookieValue.split(".")).toHaveLength(3);
    const redirect = mgr.verify(ss.cookieValue, ss.nonce);
    expect(redirect).toBe("/dashboard");
  });

  it("verify mismatched nonce throws (CSRF suspected)", () => {
    const ss = mgr.issue("/dashboard");
    expect(() => mgr.verify(ss.cookieValue, "forged-nonce")).toThrow(/nonce mismatch/);
  });

  it("verify tampered signature throws", () => {
    const ss = mgr.issue("/dashboard");
    const parts = ss.cookieValue.split(".");
    const tampered = parts[0] + ".AAAAAAAAAAAAAAAAAAAA." + parts[2]!;
    expect(() => mgr.verify(tampered, parts[0]!)).toThrow(/signature/);
  });

  it("verify missing cookie throws", () => {
    expect(() => mgr.verify("", "any")).toThrow(/missing/);
  });

  it("verify missing body state throws", () => {
    const ss = mgr.issue("/dashboard");
    expect(() => mgr.verify(ss.cookieValue, "")).toThrow(/missing/);
  });

  it("cookieName and maxAge exposed", () => {
    expect(StateCookieManager.cookieName).toBe("lab_sso_state");
    expect(StateCookieManager.maxAgeSeconds).toBeGreaterThan(0);
  });
});
