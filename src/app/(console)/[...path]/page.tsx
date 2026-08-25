"use client";

// catch-all route /<path>/... — 业务页占位（CLAUDE.md §3 禁业务）
//
// 真业务页在 lab-management-system-react / lab-management-system-vue。
// 本路由只渲染 AppShell + 「业务页在此」说明卡片。

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useBackendMenus, type MenuNode } from "@/components/app/sidebar-nav";

function findByPath(tree: MenuNode[], path: string): MenuNode | null {
  for (const n of tree) {
    if (n.path === path) return n;
    const c = findByPath(n.children, path);
    if (c) return c;
  }
  return null;
}

function findByCode(tree: MenuNode[], code: string): MenuNode | null {
  for (const n of tree) {
    if (n.code === code) return n;
    const c = findByCode(n.children, code);
    if (c) return c;
  }
  return null;
}

export default function CatchAllPage() {
  const params = useParams<{ path: string[] }>();
  const { data: menus } = useBackendMenus();

  const path = useMemo(() => {
    if (!params?.path) return "";
    return Array.isArray(params.path) ? params.path.join("/") : params.path;
  }, [params]);

  const node = menus ? (findByPath(menus, path) ?? findByCode(menus, path)) : null;

  return (
    <div className="space-y-4 max-w-3xl">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">
            {node ? node.name : `未找到：${path}`}
          </h2>
          <p className="text-sm text-slate-500">
            这是 lab-management-system-nextjs 的 wiring 层路由。
            {node
              ? `菜单 code=${node.code}，path=${node.path ?? "(无)"}，type=${node.type}。`
              : "该路径不在 saas 菜单树里。"}
          </p>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            业务实现：合同 / 接样 / 报告 / M06 检测能力 等页面在{" "}
            <code className="font-mono">lab-management-system-react</code> /
            <code className="font-mono">lab-management-system-vue</code>。 本仓按
            CLAUDE.md §3 禁业务，只做 SSO + 菜单 + 4-backend 切换接线层。
          </p>
          <div className="mt-4">
            <a href="/" className="text-blue-600 hover:underline text-sm">
              ← 返回 Lab Operational Console
            </a>
          </div>
        </div>
    </div>
  );
}
