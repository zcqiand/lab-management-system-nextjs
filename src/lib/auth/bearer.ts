// Bearer token 解析。ADR-0019 配套：unauthorized 严格 = 401，不静默走 demo。
//
// 本仓 demo 路由均不校验 JWT 签名（aspnetcore 仓验签、这里只解 payload）。
// 共享给 /api/auth/{me,menus,switch-tenant} 等需要从 Authorization 头取 sub 的路由。

/** 从 Authorization: Bearer <jwt> 解 JWT payload sub。失败返 null（调用方 401）。 */
export function subFromBearer(authz: string | null): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
