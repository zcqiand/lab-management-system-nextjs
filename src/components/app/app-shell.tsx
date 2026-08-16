"use client";

// AppShell — sidebar (left) + content (right) 操作页面骨架。
//
// 与 saas 仓 AppShell 的差异：
//   - 不引 TenantProvider（lab-nextjs 没有 tenant 概念，只有 auth-context）
//   - 菜单从 /api/saas/me/menus 拉（实验室 SaaS 多租户身份平台）
//   - 内容是 children，由调用方（page.tsx）提供
//   - 顶部 header 加 token + backend 状态 + 登出按钮

import Link from "next/link";
import { LogOut, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav, useSaasApp, useSaasMenus } from "@/components/app/sidebar-nav";
import { BackendSwitcher } from "@/components/app/backend-switcher";
import { useAuth } from "@/state/auth-context";
import { useBackend } from "@/state/backend-context";

const APP_CODE = process.env.NEXT_PUBLIC_LAB_APP_CODE ?? "lab-management";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { token, clearToken } = useAuth();
  const { backend } = useBackend();
  const { data: menus } = useSaasMenus();
  // 应用名来自 saas 公共应用目录（/api/v1/apps/<code> 反代），不写死在客户端
  const { app } = useSaasApp();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <SidebarNav
        menus={menus}
        appCode={APP_CODE}
        appName={app?.name}
        footerExtras={<BackendSwitcher />}
        version={`lab-management-system-nextjs · 接线层 · appCode=${APP_CODE}`}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center px-6 gap-4">
          <h1 className="text-base font-semibold" data-testid="appshell-app-name">
            {app?.name ?? "Lab Operational Console"}
          </h1>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="font-mono">
              应用=<span className="text-slate-900 font-medium">{app?.name ?? APP_CODE}</span>
            </span>
            <span className="font-mono">
              backend=<span className="text-slate-900 font-medium">{backend}</span>
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
  const { loading, error } = useSaasMenus();
  if (loading) {
    return (
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在从 saas 拉菜单…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        saas 菜单不可达：{error}
      </div>
    );
  }
  return null;
}
