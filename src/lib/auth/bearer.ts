// Bearer token 解析。ADR-0019 配套：unauthorized 严格 = 401，不静默走 demo。
//
// 本仓 demo 路由均不校验 JWT 签名（aspnetcore 仓验签、这里只解 payload）。
// 共享给 /api/auth/{me,menus,switch-tenant} 等需要从 Authorization 头取 sub 的路由。

/** 从 Authorization: Bearer <jwt> 解 JWT payload sub。失败返 null（调用方 401）。 */
export function subFromBearer(authz: string | null): string | null {
  return bearerClaim(authz, (p) => p.sub ?? null);
}

/**
 * 从 Authorization: Bearer <jwt> 解 tenant_id claim。失败/缺失返 null（调用方 401）。
 * 2026-09-16 T11：写路径租户身份必须来自 token（ADR-0019 禁 body 传入 / 禁 TENANT-001 兜底
 * —— contracts POST 曾要求 body.tenantId，与 aspnetcore/springboot 的 token-claim 语义分叉
 * 且构成跨租户写风险，contract-test live 比对实证）。
 */
export function tenantIdFromBearer(authz: string | null): string | null {
  return bearerClaim(authz, (p) => p.tenant_id ?? null);
}

function bearerClaim(authz: string | null, pick: (payload: { sub?: string; tenant_id?: string }) => string | null): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
      tenant_id?: string;
    };
    return pick(payload);
  } catch {
    return null;
  }
}
