# CHANGELOG — lab-management-system-nextjs

格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.3.56] — 2026-09-04

- **ADR-0020 family-wide 真库分层**：测试用 lab_test 库（共享 PG），连不上即失败不 skip。
  - `tests/setup.ts` / `tests/db.smoke.test.ts` 默认 DATABASE_URL 改为
    `postgresql://...@100.79.128.25:5432/lab_dev` → `.../lab_test`。lab_dev 仅当
    DATABASE_URL 显式设置时使用（开发手动 seed）。
- **fix(test)**：receipts-pg.test.ts 去 CI skip，改 requireReachable + 自播种子 +
  marker cleanup。家族模式与 lab-springboot/saas-springboot 的 RepositoryPgTest
  同款（真方言 + inline 种子 + 显式 cleanup，无 in-memory fallback）。原 `describe.skipIf(isCi)`
  删 —— 用户原则「测试走 memory 分支 = 默认兜底 = 隐藏 bug 的重大隐患」,
  CI=编译+mock / gate=真库 的分层改在 CI workflow 的 `--exclude` 决定（与 .NET
  `[Trait("Category","RealDb")]` + `--filter "Category!=RealDb"` 同款）。
- **fix(test infra)**：postgres-js jsonb binding —— `${jsonString}::jsonb` 在 tagged 模板
  里被 postgres-js 当 unknown literal 包装，"cannot extract elements from a scalar"。
  改 `${s.json(jsArray)}` 让 postgres-js 走 tagged 模板的 JS-对象序列化路径
  （与 seed-db.ts L200-211 同款教训）。
- **fix(me/route.ts)**：snapshot code/name pass-through 修复 ADR-0019 P2 debt。
  原版永远用 `DEMO_TENANTS_FULL` 兜底覆盖 snapshot，SSO 路径（tenantId 非
  TENANT-00x）的 code/name 被 strip → 4-way contract-test 必现 me/tenants
  `{tenantId, roleIds}` vs msw 返 `{tenantId, code, name, roleIds}`。改：
  snapshot 自带优先，DEMO_TENANTS_FULL 仅在 snapshot 缺值时补。
- **fix(login/route.ts)**：demo 路径写 snapshot 时也带 code/name（与 sso/callback
  写入路径对齐 —— 双源都补齐后 me/route.ts pass-through 才有意义）。
- **fix(ci)**：`.github/workflows/ci.yml` L4 加 `--exclude='tests/api/receipts-pg.test.ts'`
  —— CI 跑编译+mock+smoke，gate 跑真库 mutate。db.smoke.test.ts 保留跑（仅
  lab_smoke schema 自洁，不污染 public）。

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
