// M01.F05.I06 — AuthService + request → JWT claims helpers。
//
// 静态 export(避免 Next.js route handler 每次 import 都重新构建 service);
// 读 env vars 一次,后续 refresh 不会 re-init。
import { JwtClaims } from "@/lib/auth/jwt";
import { buildAuth, BuiltAuth } from "@/lib/auth/factory";
import { AuthService } from "@/lib/auth/config";

let cached: BuiltAuth | null = null;

function getAuth(): BuiltAuth {
  if (!cached) cached = buildAuth();
  return cached;
}

export function getAuthService(): AuthService {
  return getAuth().service;
}

/** 从 Authorization: Bearer <token> 或 lab_token cookie 抽 JWT,失败返 null。 */
export function readJwtFromRequest(req: Request): JwtClaims | null {
  const auth = getAuthService();
  const authz = req.headers.get("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    const token = authz.substring(7);
    try {
      return auth.getJwt().verify(token);
    } catch {
      return null;
    }
  }
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)lab_token=([^;]+)/);
  if (match) {
    try {
      return auth.getJwt().verify(decodeURIComponent(match[1]!));
    } catch {
      return null;
    }
  }
  return null;
}
