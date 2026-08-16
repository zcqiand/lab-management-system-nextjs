"use client";

// SidebarNav — 拉 saas /api/saas/me/menus，按 NEXT_PUBLIC_LAB_APP_CODE
// 过滤本仓菜单。菜单数据来自 saas，应用代码来自 env（不写死在客户端）。
//
// 与 saas 仓 SidebarNav 的差异：
//   - 不引 NavItem props（saas 用硬编码 NavItem[] + lucide 图标）
//   - 数据从接口拉；按 appCode 过滤；图标从 string → lucide 组件动态映射

import { useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter as useNextRouter,
  useSearchParams,
} from "next/navigation";
import {
  Activity,
  Beaker,
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
  /** 从 /api/saas/me/menus?appCode= 拉到的本仓菜单树（顶层节点数组） */
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

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            L
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold leading-tight truncate" data-testid="sidebar-app-name">
              {appName ?? "Lab-Management"}
            </h1>
            <p className="text-xs text-white/50 truncate">appCode = {appCode}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {tree.length === 0 ? (
          <p className="px-3 text-xs text-white/40">（无菜单）</p>
        ) : (
          tree.map((node) => (
            <NavLeaf
              key={node.id}
              node={node}
              depth={0}
              pathname={pathname}
              selected={selectedMenuCode}
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
      <div className="p-3 space-y-2">
        {footerAction}
        {footerExtras}
        {version && <div className="text-xs text-white/40 px-2">{version}</div>}
      </div>
    </aside>
  );
}

function NavLeaf({
  node,
  depth,
  pathname,
  selected,
  onSelect,
}: {
  node: MenuNode;
  depth: number;
  pathname: string;
  selected: string | null;
  onSelect: (code: string, path: string | undefined) => void;
}) {
  const isLeaf = node.children.length === 0;
  const isSelected = selected === node.code;

  // group 节点：分区标题 + 递归渲染 children
  if (!isLeaf) {
    return (
      <div className="mb-3" data-testid={`sidebar-group-${node.code}`}>
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 border-t border-white/5 first:border-t-0 first:pt-1">
          <Icon name={node.icon} />
          <span className="truncate">{node.name}</span>
        </div>
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <NavLeaf
              key={child.id}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    );
  }

  // leaf 节点（page / action）：button，深层时缩进 + 左侧 connector
  return (
    <div
      className="relative"
      style={{ marginLeft: depth > 0 ? `${depth * 0.875}rem` : 0 }}
    >
      {depth > 0 && (
        <div aria-hidden className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />
      )}
      <button
        type="button"
        onClick={() => onSelect(node.code, node.path)}
        disabled={!node.path}
        data-fn={`M98.F04.${node.code}`}
        data-testid={`sidebar-item-${node.code}`}
        className={cn(
          "relative w-full text-left flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors",
          isSelected
            ? "bg-slate-700 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white",
          !node.path && "opacity-50 cursor-not-allowed",
        )}
      >
        <Icon name={node.icon} />
        <span className="truncate">{node.name}</span>
      </button>
    </div>
  );
}

/** 客户端 hook：拉 /api/saas/me/menus?appCode=<code> */
export function useSaasMenus(): {
  data: MenuNode[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<MenuNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/saas/me/menus?appCode=${encodeURIComponent(APP_CODE)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: MenuNode[]) => {
        if (cancelled) return;
        setData(d);
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
  }, []);

  return { data, loading, error };
}

/** 客户端 hook：拉 /api/saas/app?appCode=<code>（saas 公共应用目录）。
 *  应用名不写死在客户端，由 saas 注册信息驱动；不可达时回退 null（调用方显示占位）。 */
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/saas/app?appCode=${encodeURIComponent(APP_CODE)}`, {
      cache: "no-store",
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
  }, []);

  return { app, loading, error };
}

const APP_CODE = process.env.NEXT_PUBLIC_LAB_APP_CODE ?? "lab-management";
