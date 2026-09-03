"use client";

// (console) route group 共享壳 — 所有带 AppShell 的业务页统一在这一层包。
//
// 为什么放 layout 不放各 page：App Router 导航时只有共享 layout 子树保持挂载，
// page 级内容整棵替换。之前每个 page 各自包 <AppShell>，切菜单时 sidebar
// unmount → remount，菜单重新拉取闪一下（useBackendMenus 无缓存）。
// 收敛到 layout 后：切菜单只换右侧 <section> 里的 children，侧栏稳定。
//
// 守卫：未登录 → 跳 /login（SSO）。原来 3 个 page 各自的守卫收敛到这里。
// /login 与 /api/** 留在组外（不套壳）。
//
// Suspense：SidebarNav 用了 useSearchParams，静态预渲染时需要 CSR bail-out 边界。

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/state/auth-context";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  // hydrate 完成前 token 是 null（避免 SSR/CSR mismatch）
  // hydrate 完成前 token 是 null（避免 SSR/CSR mismatch）
  // @entry M01.F04.I02 — 路由守卫：未登录（无 token）→ router.replace(/login) + 守卫占位 UI（hydrate 完成前的中间态）
  if (!hydrated || !token) {
    return (
      <main
        data-fn="M01.F04.I02"
        data-testid="console-layout-guard"
        className="min-h-screen flex items-center justify-center text-sm text-slate-500"
      >
        未登录，跳 /login 中...
      </main>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
