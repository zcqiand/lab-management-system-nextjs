// ADR-0009 菜单快照缓存 — 镜像 springboot MenuSnapshotCache（方案 B）。
//
// 背景：saas 无 client_credentials、lab 库无 menus 表，唯一拿到「按用户角色
// 过滤的菜单」的时点是 SSO callback / refresh 瞬时持有 saas accessToken。
// 在那两个时点顺手调一次 saas /api/v1/me/menus，映射成契约 MenuNode 后
// 存入本缓存；GET /api/auth/menus 按 JWT sub 读，miss 回退 demo 菜单。
//
// 局限（单实例部署下可接受，与 springboot 同款）：进程内缓存多实例不共享；
// TTL 30min 后需 refresh 或重登重新填充；菜单变更生效时延 = min(refresh 周期, TTL)。

export interface ContractMenuNode {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: ContractMenuNode[];
}

/** saas EffectiveMenuNode（MenuRow + children 树，saas /me/menus 返回形状）。 */
interface SaasMenuNode {
  id: string;
  appId?: string;
  code?: string;
  name: string;
  path?: string | null;
  icon?: string | null;
  type?: string;
  sortOrder?: number;
  children?: SaasMenuNode[];
}

interface MenuSnapshot {
  menus: ContractMenuNode[];
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;

/** 模块级单例：Next.js route handler 静态 export 场景下跨请求存活（dev HMR 会重置，可接受）。 */
const store = new Map<string, MenuSnapshot>();

/** 写入/覆盖某用户的菜单快照（userId 为 JWT sub）。空参静默忽略。 */
export function putMenuSnapshot(userId: string | null | undefined, menus: ContractMenuNode[] | null): void {
  if (!userId || !menus) return;
  store.set(userId, { menus, expiresAt: Date.now() + TTL_MS });
}

/** 读某用户的未过期快照；miss/过期返回 null（调用方回退 demo 菜单）。 */
export function getMenuSnapshot(userId: string | null | undefined): ContractMenuNode[] | null {
  if (!userId) return null;
  const snap = store.get(userId);
  if (!snap || snap.expiresAt < Date.now()) return null;
  return snap.menus;
}

/** 测试用：清空缓存。 */
export function __resetMenuSnapshotCache(): void {
  store.clear();
}

/**
 * 拉取并缓存某用户的 saas 菜单快照。失败（saas 5xx/网络/4xx）只 console.warn
 * 不抛 — 菜单不可用不应阻塞登录主流程（与 springboot cacheMenus 同语义）。
 *
 * 2026-08-28 saas MeService 真实现起，/me/menus 响应形状是
 * {@link Record}<appCode, EffectiveMenuNode[]>（shared 契约
 * saas-identity-platform-shared/tsp/routes/me.tsp getMyMenus 返
 * Record<EffectiveMenuNode[]>）—— 一次返该用户所有 app 下的菜单，本仓按 appCode
 * 取自己的子树再映射。早期错误版本把整个响应当 flat 数组 cast，tree.map 抛
 * `i.map is not a function`（对象无 .map），catch 吞掉 → 快照永远空 →
 * /api/auth/menus 503 MENUS_UNAVAILABLE。 springboot / aspnetcode 同款契约
 * 2026-08-28 同步改了，本仓漏改。
 */
export async function cacheMenuSnapshot(
  userId: string | null | undefined,
  saasAccessToken: string,
  saasBaseUrl: string,
  appCode = "lab-management",
): Promise<void> {
  if (!userId || !saasAccessToken) return;
  try {
    const url = `${saasBaseUrl.replace(/\/$/, "")}/api/v1/me/menus?appCode=${encodeURIComponent(appCode)}`;
    const resp = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${saasAccessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.warn(`[menu-snapshot] saas /me/menus ${resp.status} for user ${userId}`);
      return;
    }
    const body = (await resp.json()) as Record<string, SaasMenuNode[] | undefined>;
    const tree = body[appCode] ?? []; // appCode 不在响应里 → 空快照（与 no-sso 兜底对齐）
    putMenuSnapshot(userId, tree.map(mapSaasMenu));
  } catch (err) {
    console.warn(`[menu-snapshot] fetch failed for user ${userId}: ${(err as Error).message}`);
  }
}

/** saas EffectiveMenuNode → 契约 MenuNode（name→label，剥掉 appId/code 等本地不消费字段）。 */
function mapSaasMenu(node: SaasMenuNode): ContractMenuNode {
  const children = node.children ?? [];
  const out: ContractMenuNode = { id: node.id, label: node.name };
  if (node.path) out.path = node.path;
  if (node.icon) out.icon = node.icon;
  if (children.length > 0) out.children = children.map(mapSaasMenu);
  return out;
}
