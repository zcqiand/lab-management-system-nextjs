# CHANGELOG — lab-management-system-nextjs

格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.3.55] — 2026-08-27

- M01.F04.I04 前端失败语义改为上抛错误，不再静默回退静态树（与 react/vue 仓同款）：
  - `useBackendMenus` 拉取失败保留 error state，render 阶段 `if (error) throw error`
  - 401 走 hook 内 `clearToken() + window.location.assign('/login')`，**不**写
    error state（避免 render throw 破坏重定向；token 过期不该给用户看错误界面）
  - 新增 `AppShellErrorBoundary` 渲染「菜单加载失败」错误态（图标 / msg / 提示）
  - AppShell：menusLoading 渲染「菜单加载中…」aside；不再 `?? []` 兜底
  - `MenuStatusBanner` 不读 error（避免 Banner 自身触发 render throw）
  - 测试 sidebar-nav.direct.dom.test.tsx：500 miss → ErrorBoundary 接住 → 错误态；
    401 → 仍 clearToken + 重定向 /login（保留旧断言）

## [0.3.54] — 2026-08-27

- 初始化台账：Next.js 15 全栈仓（前端 + API routes）。历史变更见 git log 与 `.state/session.json`。
