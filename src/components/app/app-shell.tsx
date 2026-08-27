"use client";

// AppShell — sidebar (left) + content (right) 操作页面骨架。
//
// 与 saas 仓 AppShell 的差异：
//   - 不引 TenantProvider（lab-nextjs 没有 tenant 概念，只有 auth-context）
//   - 菜单从后端 /api/auth/menus 拉（ADR-0009：saas 快照缓存 → miss 503，
//     2026-08-27 起 demo 兜底删除，useBackendMenus 失败 render 抛错，
//     AppShellErrorBoundary 兜渲染错误态）
//   - 内容是 children，由调用方（page.tsx）提供
//   - 顶部 header 加 token + backend 状态 + 登出按钮

import React from "react";
import Link from "next/link";
import { LogOut, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav, useSaasApp, useBackendMenus } from "@/components/app/sidebar-nav";
import { BackendBadge } from "@/components/app/backend-badge";
import { useAuth } from "@/state/auth-context";
import { getApiMode } from "@/api/backend-config";

const APP_CODE = process.env.NEXT_PUBLIC_LAB_APP_CODE ?? "lab-management";

// 菜单加载错误态（demo 兜底删除后，菜单拉不到 → 错误而非 sidebar 全白）。
function MenuLoadError({ error }: { error: Error }) {
  return (
    <aside
      className="w-64 shrink-0 border-r bg-white flex flex-col items-center justify-center p-6 text-center"
      data-testid="appshell-menu-error"
    >
      <AlertCircle className="h-8 w-8 text-rose-700 mb-3" />
      <h2 className="text-base font-semibold text-rose-700 mb-2">菜单加载失败</h2>
      <p className="text-xs text-slate-600 mb-4 break-all" data-testid="appshell-menu-error-msg">
        {error.message}
      </p>
      <p className="text-xs text-slate-500">
        后端 /api/auth/menus miss（503 MENUS_UNAVAILABLE）；demo 兜底已删除，请重登或联系管理员。
      </p>
    </aside>
  );
}

// AppShell 顶层错误边界：捕获 useBackendMenus 拉取失败的 render 抛错，
// 渲染「菜单加载失败」错误态；其它子树抛错（如 useSaasApp）也兜。
// 401 走 hook 内 location.assign('/login')，不进错误边界。
export class AppShellErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error) {
      return <MenuLoadError error={this.state.error} />;
    }
    return this.props.children;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { token, clearToken } = useAuth();
  const apiMode = getApiMode();
  const { data: menus, loading: menusLoading } = useBackendMenus();
  // 应用名来自 saas 公共应用目录（/api/v1/apps/<code> 反代），不写死在客户端
  const { app } = useSaasApp();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {menusLoading ? (
        <aside
          className="w-64 shrink-0 border-r bg-white flex items-center justify-center"
          data-testid="appshell-menu-loading"
        >
          <span className="text-xs text-slate-500">菜单加载中…</span>
        </aside>
      ) : (
        <SidebarNav
          menus={menus ?? []}
          appCode={APP_CODE}
          appName={app?.name}
          footerExtras={<BackendBadge />}
          version={`lab-management-system-nextjs · 接线层 · appCode=${APP_CODE}`}
        />
      )}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center px-6 gap-4">
          <h1 className="text-base font-semibold" data-testid="appshell-app-name">
            {app?.name ?? "Lab Operational Console"}
          </h1>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="font-mono">
              应用=
              <span className="text-slate-900 font-medium">{app?.name ?? APP_CODE}</span>
            </span>
            <span className="font-mono">
              backend=<span className="text-slate-900 font-medium">{apiMode}</span>
            </span>
            <span className="font-mono">
              token=
              <span className="text-slate-900 font-medium">
                {token ? `${token.slice(0, 16)}…` : "无"}
              </span>
            </span>
            {token ? (
              <Button
                variant="outline"
                size="sm"
                data-fn="M01.F05.I05"
                data-testid="logout-button"
                onClick={() => {
                  clearToken();
                  window.location.href = "/login";
                }}
              >
                <LogOut className="h-4 w-4 mr-1" />
                登出
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">去登录</Link>
              </Button>
            )}
          </div>
        </header>
        <section className="flex-1 overflow-auto p-6">{children}</section>
      </main>
    </div>
  );
}

export function MenuStatusBanner() {
  // 仅展示加载态；失败语义由 ErrorBoundary 兜（demo 兜底删除后，
  // 不再静默回退静态树——useBackendMenus render 时抛错，此处故意不读 error
  // 避免 Banner 自身触发抛错，破坏 AppShell 错误态渲染）。
  const { loading } = useBackendMenus();
  if (loading) {
    return (
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在拉菜单…
      </div>
    );
  }
  return null;
}