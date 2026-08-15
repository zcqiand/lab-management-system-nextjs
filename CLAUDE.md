# CLAUDE.md — lab-management-system-nextjs

> 入口，不是手册。双角色声明 + 禁止事项 + 指向别处。L0 上限 60 行。

## 1. 角色

**Full-stack 前端 + schema emit infra 仓**。Next.js 技术栈特殊：既是前端，又可通过 API routes 作后端。本仓双角色：

1. **前端（lab 家族产品之一）**：消费 `../lab-management-system-shared/generated/openapi/openapi.yaml`，
   通过 apiclient (`src/api/`) + 4-backend 切换（msw/aspnetcore/springboot/nextjs）跨后端。
   UI 包含：AppShell + SidebarNav（菜单来自 saas）+ M01 合同管理页面。
2. **后端（nextjs 自作）**：`src/app/api/auth/{login,me,logout,refresh,switch-tenant}` 5 个 M00 auth 路由 + `/api/contracts/*` 业务路由。
   切换到 'nextjs' 模式时，前端 apiclient 命中本仓 API routes。业务路由数据来自 `@lab/management-system-msw/fixtures`（in-memory）。
3. **infra 副作用**：`scripts/{emit-schema, borrow-pg, borrow-from-nextjs-pg, v-sql-to-dbml}.mjs` 与
   `generated/` 输出。被 `../lab-management-system-shared/scripts/sync-db.mjs` 借 `pg` driver。

## 2. 技术栈

`nextjs` profile + PostgreSQL（pg devDep）+ Drizzle PG（emit 用）+ pg client（runtime）。
业务栈引文请回到 `lab-management-system-react` / `lab-management-system-vue`。
orval client = `axios`（不走 react-query；服务端组件也可调）。

## 3. 禁止事项

- **禁手写 DDL**：`shared/sql/migrations/V*.sql` 是真源。
- **禁提交 `generated/`**：`generated/{schema.sql, schema.dbml, schema.ts}` 与 `src/api/endpoints/` 均 gitignored；跑 `npm run gen:shared` / `node scripts/emit-schema.mjs` 重出。
- **禁 `pg` 升 dependencies**：必须留 `devDependencies`（sync-db.mjs 的借链不能进消费方 runtime bundle）。
- **禁先改代码后改 function tree**：M01 起业务页也要走 `/tree-change` 翻状态再 commit。
- npm 依赖一律走 `registry.npmmirror.com`。

## 4. 指向别处

- SSOT（DDL 真源） → `../lab-management-system-shared/sql/migrations/`
- 契约 / OpenAPI → `../lab-management-system-shared/generated/openapi/openapi.yaml`
- 借 pg 消费方 → `../lab-management-system-shared/scripts/sync-db.mjs:36-46`
- 家族兄弟 → `../lab-management-system-react` / `../lab-management-system-vue` / `../lab-management-system-msw`
- 功能清单 → `docs/functions/function-tree.md`
- 决策背景 → `docs/adr/`

## 5. 工作循环

1. `npm install`（一次性；提供 pg / drizzle / orval / next）
2. `npm run gen:shared`（调 shared emit:openapi + 本仓 orval → `src/api/endpoints/`）
3. `node scripts/borrow-pg.mjs` — 验证 pg 借链与 lab_dev 可达（L4 smoke 同款路径）
4. `npm run dev` 或 `python scripts/gate.py -p lab-management-system-nextjs`
