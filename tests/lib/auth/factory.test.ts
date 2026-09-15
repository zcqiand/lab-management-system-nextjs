// readLabConfig fail-fast 语义（CLAUDE.md §2 禁 env 默认值兜底——2026-09-15 存量违规修复）。
//
// 背景：factory.ts 曾对 LAB_JWT_SECRET 等 6 键写 ?? 字面量兜底，且以 param 形式
// `env.X ?? "..."` 访问——绕过了 L0.no_fallback 只认 `process.env.X` 的正则，
// 成为门禁盲区。deploy 链（lab.env 自举 + append_if_missing）与四份 env 契约
// 早已覆盖全部 6 键 → 改缺失即 throw，不再有静默 dev 字面量。
// LAB_SAAS_* 组不要求：no-sso profile 下合法缺省，real profile 由
// HttpSaasAuthClient / HttpSaasMeClient 构造器逐项 fail-fast（saas.ts）。
import { describe, expect, it } from "vitest";
import { readLabConfig } from "@/lib/auth/factory";

const FULL_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test", // Next.js typegen 把 NODE_ENV 标记为必填
  LAB_SSO_PROFILE: "no-sso",
  LAB_JWT_SECRET: "dev-key-32-bytes-minimum-length!",
  LAB_JWT_ISSUER: "lab-management-system",
  LAB_JWT_TTL_SECONDS: "3600",
  LAB_JWT_REFRESH_TTL_SECONDS: "604800",
  LAB_AUTH_DEV_PASSWORD: "dev123456",
};

const REQUIRED_KEYS = [
  "LAB_SSO_PROFILE",
  "LAB_JWT_SECRET",
  "LAB_JWT_ISSUER",
  "LAB_JWT_TTL_SECONDS",
  "LAB_JWT_REFRESH_TTL_SECONDS",
  "LAB_AUTH_DEV_PASSWORD",
] as const;

describe("readLabConfig fail-fast（CLAUDE.md §2 禁 env 默认值兜底）", () => {
  it("完整 env → 原样装配，无兜底改写", () => {
    const cfg = readLabConfig({ ...FULL_ENV, LAB_JWT_ISSUER: "custom-issuer" });
    expect(cfg.jwt.issuer).toBe("custom-issuer");
    expect(cfg.profile).toBe("no-sso");
    expect(cfg.jwt.secret).toBe(FULL_ENV.LAB_JWT_SECRET);
    expect(cfg.jwt.ttlSeconds).toBe(3600);
  });

  it.each([...REQUIRED_KEYS])("缺 %s → throw 且错误信息点名该 key", (key) => {
    const env = { ...FULL_ENV } as Record<string, string | undefined>;
    delete env[key];
    expect(() => readLabConfig(env as NodeJS.ProcessEnv)).toThrow(new RegExp(key));
  });

  it("LAB_SAAS_* 组缺省合法（no-sso profile；real 由 HttpSaasAuthClient 构造器 fail-fast）", () => {
    expect(() => readLabConfig({ ...FULL_ENV })).not.toThrow();
    const cfg = readLabConfig({ ...FULL_ENV });
    expect(cfg.sso.clientId).toBe("");
    expect(cfg.sso.saasBaseUrl).toBe("");
  });

  it("源码回归锁：factory.ts 不再含 6 键的 ?? 字面量兜底（param 形式是 no_fallback 门盲区）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth/factory.ts"),
      "utf8",
    );
    for (const key of REQUIRED_KEYS) {
      expect(src, `${key} 不得再有 ?? 字面量兜底`).not.toMatch(
        new RegExp(`${key}\\s*\\?\\?\\s*"`),
      );
    }
  });
});
