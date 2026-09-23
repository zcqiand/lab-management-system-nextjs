// requireTenant — BFF 全域 token 化的统一 401 入口（ADR-0019）。
//
// 契约：
//   - 从 Authorization: Bearer <jwt> 解 tenant_id claim（复用 tenantIdFromBearer）
//   - 解出 → { tenantId }，调用方继续
//   - 无头 / 非 Bearer / 坏 JWT / 缺 claim → NextResponse 401，
//     信封 { code: "UNAUTHORIZED", message: "tenant_id claim is required (ADR-0019)" }
//     （与 contracts POST 2026-09-16 T11 语义逐字节一致）
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { describe, expect, it } from "vitest";
import { LabJwtSigner } from "@/lib/auth/jwt";

const signer = new LabJwtSigner(
  "dev-key-32-bytes-minimum-length!",
  "lab-management-system",
  3600,
  604800,
);

function req(authz?: string): Request {
  return new Request("http://localhost:5201/api/contracts", {
    headers: authz === undefined ? {} : { authorization: authz },
  });
}

describe("requireTenant 统一 401 入口", () => {
  it("合法 Bearer（含 tenant_id claim）→ 返回 tenantId，不返回 Response", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const token = signer.issue("USER-A", "TENANT-001");
    const r = requireTenant(req(`Bearer ${token}`));
    expect(r).toEqual({ tenantId: "TENANT-001" });
  });

  it("SSO 世界 UUID 租户 claim 同样解出", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const token = signer.issue("USER-A", "00000000-0000-0000-0000-000000000001");
    const r = requireTenant(req(`Bearer ${token}`));
    expect(r).toEqual({ tenantId: "00000000-0000-0000-0000-000000000001" });
  });

  it("无 Authorization 头 → 401 信封", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const res = requireTenant(req()) as Response;
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.message).toBe("tenant_id claim is required (ADR-0019)");
  });

  it("非 Bearer scheme → 401", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const res = requireTenant(req("Basic dXNlcjpwYXNz")) as Response;
    expect(res.status).toBe(401);
  });

  it("坏 JWT（不是三段）→ 401", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const res = requireTenant(req("Bearer not-a-jwt")) as Response;
    expect(res.status).toBe(401);
  });

  it("合法 JWT 但缺 tenant_id claim → 401（禁兜底，缺失不默认租户）", async () => {
    const { requireTenant } = await import("@/lib/auth/require-tenant");
    const token = signer.issue("USER-A", "");
    const res = requireTenant(req(`Bearer ${token}`)) as Response;
    expect(res.status).toBe(401);
  });
});
