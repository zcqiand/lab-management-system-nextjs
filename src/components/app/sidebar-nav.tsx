"use client";

// SidebarNav — 菜单走 lab 后端 GET /api/auth/menus（ADR-0009，2026-08-25 起
// 取代浏览器直连 saas /api/v1/me/menus：后端 SSO callback 时快照缓存 saas
// 菜单，miss 回退 demo 树）。应用名仍走 saas 公共目录 /api/v1/apps/[code]
// （免鉴权），应用代码来自 env（不写死在客户端）。
//
// 与 saas 仓 SidebarNav 的差异：
//   - 不引 NavItem props（saas 用硬编码 NavItem[] + lucide 图标）
//   - 数据从接口拉；按 appCode 过滤；图标从 string → lucide 组件动态映射
//   - 新增可收起/展开：width 60↔14，text/group 标签 display-none，图标列保持。
//     状态持久化到 localStorage（key=`sidebar.collapsed.<appCode>`），刷新保留。

import { useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter as useNextRouter,
  useSearchParams,
} from "next/navigation";
import {
  Activity,
  Beaker,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  ScrollText,
  Settings,
  Shield,
  TestTube2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/state/auth-context";
import { authGetMenus } from "@/api/endpoints/endpoints";
import type { MenuNode as ContractMenuNode } from "@/api/endpoints/endpoints.schemas";

// 与 saas 的 EffectiveMenuNode 对齐（手写，避免跨仓依赖）
interface MenuNode {
  id: string;
  appId: string;
  parentId?: string;
  code: string;
  name: string;
  path?: string;
  icon?: string;
  type: "group" | "page" | "action";
  sortOrder: number;
  children: MenuNode[];
}

export type { MenuNode };

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FlaskConical,
  TestTube2,
  Beaker,
  ClipboardList,
  FileText,
  ScrollText,
  Shield,
  Wrench,
  Settings,
  PackageSearch,
  Database,
  Activity,
  ListChecks,
};

function Icon({ name }: { name?: string }) {
  const C = name ? ICON_MAP[name] : undefined;
  if (!C) return <span className="h-4 w-4 inline-block" aria-hidden />;
  return <C className="h-4 w-4" />;
}

interface SidebarNavProps {
  /** 从后端 /api/auth/menus 拉到的本仓菜单树（顶层节点数组，ADR-0009） */
  menus: MenuNode[] | null;
  appCode: string;
  /** saas 注册的应用名（/api/saas/app 拉取）；缺省回退 Lab-Management */
  appName?: string | null;
  /** Sidebar 底部主操作（如登出按钮） */
  footerAction?: React.ReactNode;
  /** 次要操作（如后端模式切换器） */
  footerExtras?: React.ReactNode;
  version?: string;
}

export function SidebarNav({
  menus,
  appCode,
  appName,
  footerAction,
  footerExtras,
  version = "lab-management-system-nextjs · 接线层",
}: SidebarNavProps) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useNextRouter();
  const selectedMenuCode = sp.get("menu");

  const tree = useMemo<MenuNode[]>(() => menus ?? [], [menus]);

  // 全局收起/展开：状态持久化到 localStorage（按 appCode 区分），刷新保留
  const SIDEBAR_KEY = `sidebar.collapsed.${appCode}`;
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIDEBAR_KEY);
      if (v === "1") setCollapsed(true);
    } catch { /* SSR / 无 storage 时忽略 */ }
    setHydrated(true);
  }, [SIDEBAR_KEY]);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  };
  // 防止 SSR/CSR 阶段不一致闪烁：未水合前按展开渲染
  const effectiveCollapsed = hydrated ? collapsed : false;

  // 分组收起/展开：每个 group code 一项，按 appCode 持久化到 JSON 字符串
  // 仅在 sidebar 展开态生效（icon-only 模式全部铺开，看不到分组 toggle 的意义）
  const GROUPS_KEY = `sidebar.groups.${appCode}`;
  const [groupCollapsed, setGroupCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GROUPS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) setGroupCollapsed(new Set(arr.filter((x): x is string => typeof x === "string")));
      }
    } catch { /* ignore */ }
  }, [GROUPS_KEY]);
  const toggleGroup = (code: string) => {
    setGroupCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "shrink-0 bg-slate-900 text-white flex flex-col transition-[width] duration-200",
        effectiveCollapsed ? "w-14" : "w-60",
      )}
      data-collapsed={effectiveCollapsed}
      data-fn="M01.F04.I04"
      data-testid="sidebar-nav"
      aria-label="主导航"
    >
      <div className={cn("flex items-center py-4 border-b border-white/10", effectiveCollapsed ? "px-2 justify-center" : "px-5")}>
        <div className={cn("flex items-center gap-2", effectiveCollapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
            L
          </div>
          {!effectiveCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold leading-tight truncate" data-testid="sidebar-app-name">
                {appName ?? "Lab-Management"}
              </h1>
              <p className="text-xs text-white/50 truncate">appCode = {appCode}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={effectiveCollapsed ? "展开菜单" : "收起菜单"}
          aria-label={effectiveCollapsed ? "展开菜单" : "收起菜单"}
          aria-expanded={!effectiveCollapsed}
          className={cn(
            "shrink-0 ml-auto h-7 w-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10",
            effectiveCollapsed && "ml-0",
          )}
          data-testid="sidebar-toggle"
        >
          {effectiveCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 overflow-y-auto" aria-label="菜单树">
        {tree.length === 0 ? (
          <p className={cn("text-xs text-white/40", effectiveCollapsed ? "text-center" : "px-3")}>
            {effectiveCollapsed ? "—" : "（无菜单）"}
          </p>
        ) : (
          tree.map((node) => (
            <NavLeaf
              key={node.id}
              node={node}
              depth={0}
              pathname={pathname}
              selected={selectedMenuCode}
              collapsed={effectiveCollapsed}
              groupCollapsed={effectiveCollapsed ? new Set<string>() : groupCollapsed}
              onToggleGroup={effectiveCollapsed ? () => undefined : toggleGroup}
              onSelect={(code, path) => {
                // 叶子节点（有 path）→ 跳 /<path>，业务页占位
                // group 节点（无 path）→ 只切 ?menu= 反映选中
                if (path) {
                  router.push(`/${path}`);
                } else {
                  const params = new URLSearchParams(sp.toString());
                  params.set("menu", code);
                  router.replace(`${pathname}?${params.toString()}`);
                }
              }}
            />
          ))
        )}
      </nav>
      <Separator className="bg-white/10" />
      <div className={cn("space-y-2", effectiveCollapsed ? "p-2 flex flex-col items-center" : "p-3")}>
        {footerAction}
        {footerExtras}
        {version && (
          <div className={cn("text-xs text-white/40 truncate", effectiveCollapsed ? "text-[10px] text-center" : "px-2")}>
            {effectiveCollapsed ? "v" : version}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLeaf({
  node,
  depth,
  pathname,
  selected,
  collapsed,
  groupCollapsed,
  onToggleGroup,
  onSelect,
}: {
  node: MenuNode;
  depth: number;
  pathname: string;
  selected: string | null;
  collapsed: boolean;
  groupCollapsed: Set<string>;
  onToggleGroup: (code: string) => void;
  onSelect: (code: string, path: string | undefined) => void;
}) {
  const isLeaf = node.children.length === 0;
  const isSelected = selected === node.code;

  // group 节点：分区标题（可点击收/展）+ 子项列表
  if (!isLeaf) {
    const isGroupCollapsed = groupCollapsed.has(node.code);
    const childCount = node.children.length;
    const showHeaderButton = !collapsed; // 仅展开态有可点击的 header
    return (
      <div className="mb-3" data-testid={`sidebar-group-${node.code}`} data-group-collapsed={isGroupCollapsed}>
        <div
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 border-t border-white/5 first:border-t-0",
            collapsed ? "justify-center px-0 pt-3 pb-1" : "px-3 pt-3 pb-1",
          )}
        >
          {!showHeaderButton ? (
            // icon-only 模式：只有图标，hover title 提示整组（连子项）
            <span title={`${node.name} · ${childCount} 项`}>
              <Icon name={node.icon} />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onToggleGroup(node.code)}
              title={isGroupCollapsed ? `展开「${node.name}」` : `收起「${node.name}」`}
              aria-label={isGroupCollapsed ? `展开「${node.name}」` : `收起「${node.name}」`}
              aria-expanded={!isGroupCollapsed}
              className="flex items-center gap-1.5 hover:text-white/80 transition-colors text-left flex-1 min-w-0"
              data-testid={`sidebar-group-toggle-${node.code}`}
            >
              <Icon name={node.icon} />
              <span className="truncate">{node.name}</span>
              <span className="ml-auto inline-flex items-center text-white/30">
                <span className="text-[9px] tabular-nums mr-1">{childCount}</span>
                <ChevronToggle expanded={!isGroupCollapsed} />
              </span>
            </button>
          )}
        </div>
        {!isGroupCollapsed && (
          <div className="space-y-0.5">
            {node.children.map((child) => (
              <NavLeaf
                key={child.id}
                node={child}
                depth={depth + 1}
                pathname={pathname}
                selected={selected}
                collapsed={collapsed}
                groupCollapsed={groupCollapsed}
                onToggleGroup={onToggleGroup}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // leaf 节点（page / action）：button，深层时缩进 + 左侧 connector
  return (
    <div
      className="relative"
      style={{ marginLeft: !collapsed && depth > 0 ? `${depth * 0.875}rem` : 0 }}
    >
      {depth > 0 && !collapsed && (
        <div aria-hidden className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />
      )}
      <button
        type="button"
        onClick={() => onSelect(node.code, node.path)}
        disabled={!node.path}
        data-fn={`M98.F04.${node.code}`}
        data-testid={`sidebar-item-${node.code}`}
        title={collapsed ? node.name : undefined}
        aria-label={collapsed ? node.name : undefined}
        className={cn(
          "relative w-full text-left flex items-center gap-2 rounded text-sm transition-colors",
          collapsed ? "justify-center px-0 py-2" : "px-3 py-1.5",
          isSelected
            ? "bg-slate-700 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white",
          !node.path && "opacity-50 cursor-not-allowed",
        )}
      >
        <Icon name={node.icon} />
        {!collapsed && <span className="truncate">{node.name}</span>}
      </button>
    </div>
  );
}

/** 分组 header 用的 chevron 指示器 */
function ChevronToggle({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn("transition-transform duration-150", expanded ? "rotate-0" : "-rotate-90")}
    >
      <path d="M2 3.5 L5 7 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 客户端 hook：拉 lab 后端 GET /api/auth/menus（ADR-0009，2026-08-25 起取代
 *  浏览器直连 saas /api/v1/me/menus）。orval authGetMenus（axios + customFetch），
 *  Bearer token 来自 useAuth()（SSO callback 拿到的 saas accessToken，后端按
 *  JWT sub 读快照缓存；miss 503，2026-08-27 起 demo 兜底删除 → render 抛错）。
 *  token 在 auth-context 里 mount 后才 hydrate，所以 deps 用 [token]，!token 时
 *  直接 return 避免无 token 打后端。
 *  契约 MenuNode{id,label,path?,icon?,children?} 在此适配成本地渲染 MenuNode。
 *
 *  失败语义（demo 兜底删除后）：
 *    - 401：清 token + window.location.assign('/login')（保留—— token 过期不该
 *      给用户看错误界面，而该回登录页）
 *    - 其他失败（503 miss / 网络 / 500）：error state 写后 render 抛错，由 AppShell
 *      ErrorBoundary 兜渲染「菜单加载失败」错误态——不再静默回退静态树。
 */
export function useBackendMenus(): {
  data: MenuNode[] | null;
  loading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<MenuNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { token, clearToken } = useAuth();

  useEffect(() => {
    if (!token) return; // auth-context 首次 render token=null，hydrate 后 effect 重跑
    let cancelled = false;
    setLoading(true);
    authGetMenus({
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((d: ContractMenuNode[]) => {
        if (cancelled) return;
        setData(d.map(adaptContractMenu));
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const status =
          typeof cause === "object" && cause !== null && "response" in cause
            ? (cause as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 401) {
          // token 过期/被吊销：清掉回登录页（mirror apiClient legacy interceptor 模式）
          clearToken();
          if (typeof window !== "undefined") window.location.assign("/login");
          // 401 已重定向，不写 error state（避免 render 抛错破坏重定向）
          setLoading(false);
          return;
        }
        // 其他失败 → error state 写入；render 阶段抛错由 ErrorBoundary 兜
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, clearToken]);

  // render 阶段抛错 → AppShell ErrorBoundary 接住渲染错误态
  if (error) throw error;
  return { data, loading, error };
}

/** 契约 MenuNode（shared tsp：id/label/path?/icon?/children?）→ 本地渲染 MenuNode。 */
function adaptContractMenu(node: ContractMenuNode, index: number): MenuNode {
  const children = node.children ?? [];
  return {
    id: node.id,
    appId: APP_CODE,
    code: node.id,
    name: node.label,
    path: node.path,
    icon: node.icon,
    // 契约无 type 字段：有子节点即 group，否则 page
    type: children.length > 0 ? "group" : "page",
    sortOrder: index + 1,
    children: children.map(adaptContractMenu),
  };
}

/** 客户端 hook：浏览器直连 saas /api/v1/apps/<code>（saas 公共应用目录，免鉴权）。
 *  应用名不写死在客户端，由 saas 注册信息驱动；不可达时回退 null（调用方显示占位）。
 *  /apps/[code] 当前免鉴权，所以即使没 token 也拉；但若 token 存在仍带上（forward-compat，
 *  万一 saas 把这端点改成鉴权，前端不用再改）。 */
export function useSaasApp(): {
  app: { code: string; name: string; description?: string; icon?: string } | null;
  loading: boolean;
  error: string | null;
} {
  const [app, setApp] = useState<{
    code: string;
    name: string;
    description?: string;
    icon?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${SAAS_BASE}/api/v1/apps/${encodeURIComponent(APP_CODE)}`, {
      cache: "no-store",
      headers,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { code: string; name: string }) => {
        if (cancelled) return;
        setApp(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as Error).message ?? String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { app, loading, error };
}

const APP_CODE = process.env.NEXT_PUBLIC_LAB_APP_CODE ?? "lab-management";
const SAAS_BASE =
  process.env.NEXT_PUBLIC_SAAS_BASE_URL ?? "http://localhost:3000";
