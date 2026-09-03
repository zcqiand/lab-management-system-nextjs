// 2026-09-03 租户体系对齐 — memberships 快照缓存（镜像 menu-snapshot.ts 模式）。
// 设计：aspnetcore 仓 docs/superpowers/specs/2026-09-03-me-tenant-alignment-design.md
//
// 背景：sso/callback 返回 saas memberships 租户（UUID），而 /api/auth/me 曾固定
// 返回 demo TENANT-00x —— 前端 hydrateAuth 的 tenants.find(localStorage 里的
// saas UUID) 跨体系失配 → awaiting_tenant → 卡「检查登录态…」死锁。
//
// 语义：SSO callback / refresh 瞬时持有 saas accessToken 时顺手把 memberships
// 映射成 lab MyTenant 存本缓存；GET /api/auth/me 按 Bearer sub 读，hit 返回
// saas 租户体系，miss 返回 401（前端 catch 走 /api/auth/refresh 自愈 —— 该
// 路径会重填本快照）。无 Bearer（demo 路径）维持 demo 租户。
//
// 局限（与 menu-snapshot 同款）：进程内缓存多实例不共享；TTL 30min。

export interface SaasMyTenant {
  tenantId: string;
  code: string;
  name: string;
  roleIds: string[];
}

interface MembershipSnapshot {
  tenants: SaasMyTenant[];
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;

/** 模块级单例：Next.js route handler 静态 export 场景下跨请求存活（dev HMR 会重置，可接受）。 */
const store = new Map<string, MembershipSnapshot>();

/** 写入/覆盖某用户的租户快照（userId 为 saas user id）。空参静默忽略。 */
export function putMembershipSnapshot(
  userId: string | null | undefined,
  tenants: SaasMyTenant[] | null,
): void {
  if (!userId || !tenants) return;
  store.set(userId, { tenants, expiresAt: Date.now() + TTL_MS });
}

/** 读某用户的未过期快照；miss/过期返回 null。 */
export function getMembershipSnapshot(
  userId: string | null | undefined,
): SaasMyTenant[] | null {
  if (!userId) return null;
  const snap = store.get(userId);
  if (!snap || snap.expiresAt < Date.now()) return null;
  return snap.tenants;
}

/** 测试用：清空缓存。 */
export function __resetMembershipSnapshotCache(): void {
  store.clear();
}
