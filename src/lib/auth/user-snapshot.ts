// 2026-10-21 ADR-0019 收口 — 当前用户快照缓存（镜像 membership-snapshot.ts 模式）。
//
// 背景：GET /api/auth/me 与 switch-tenant 的 user 段曾写死 DEMO_USER 字面量
// （{id:"USER-A", username:"alice", displayName:"管理员", roleCode:"admin"}）——
// 任何 sub 都冒充同一个人，正是 ADR-0019「业务身份字段兜底到 demo 字面量」
// 反模式（suite 硬规则 §3）。rails 侧 resolve_user 按目录解析、miss 401；
// 本仓无用户目录持久层，对位数据源 = 登录链瞬时持有的 saas 用户段。
//
// 语义：login / sso/callback 响应里构造 lab user 时顺手写本快照（key=lab
// userId）；GET /api/auth/me 与 switch-tenant 按 Bearer sub 读，miss 返
// 401 USER_UNAVAILABLE（可恢复态：重登重建）。
//
// 局限（与 membership/menu 快照同款）：进程内缓存多实例不共享；TTL 30min。

export interface SnapshotUser {
  id: string;
  username: string;
  displayName: string;
  roleCode: string;
}

interface UserSnapshot {
  user: SnapshotUser;
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;

/**
 * globalThis 单例（membership-snapshot 同款理由）：next dev 下每个路由 bundle
 * 各持一份模块实例，模块级 `new Map` 会让 login 写进 A 实例、/me 读 B 实例
 * → 快照恒 miss。挂 globalThis 才是真·进程级单例。
 */
const _g = globalThis as unknown as {
  __userSnapshotStore?: Map<string, UserSnapshot>;
};
const store = (_g.__userSnapshotStore ??= new Map<string, UserSnapshot>());

/** 写入/覆盖某用户的身份快照（userId 为 lab userId，即 saas user id）。空参静默忽略。 */
export function putUserSnapshot(
  userId: string | null | undefined,
  user: SnapshotUser | null,
): void {
  if (!userId || !user) return;
  store.set(userId, { user, expiresAt: Date.now() + TTL_MS });
}

/** 读某用户的未过期快照；miss/过期返回 null。 */
export function getUserSnapshot(userId: string | null | undefined): SnapshotUser | null {
  if (!userId) return null;
  const snap = store.get(userId);
  if (!snap || snap.expiresAt < Date.now()) return null;
  return snap.user;
}

/** 测试用：清空缓存。 */
export function __resetUserSnapshotCache(): void {
  store.clear();
}
