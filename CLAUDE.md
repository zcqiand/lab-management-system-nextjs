# CLAUDE.md — lab-management-system-nextjs

> 入口，不是手册。infra 角色声明，禁止事项，指向别处。L0 上限 60 行。

## 1. 角色

**Schema emit infra 仓**。本仓没有业务代码、不渲染产品页面、不联业务 API。它做两件事：

1. **SSOT emit**：消费 `../lab-management-system-shared/sql/migrations/V*.sql`，
   重放到临时 PG（@ 100.79.128.25 / `lab_dev`），输出
   `generated/schema.sql` + `generated/schema.dbml` + `generated/schema.ts`。
2. **pg runtime 借出**：持有 `pg` devDep，供
   `../lab-management-system-shared/scripts/sync-db.mjs:36-46` `require("pg")`。

## 2. 技术栈

`nextjs` profile + Drizzle SQLite（仅 L4 smoke 用）+ PostgreSQL 借链（emit 用）。

业务栈引文请回到 ref（`lab-management-system-react` / `lab-management-system-vue`）。
本仓 `package.json` 里的 Next/React 仅为 L0/L4 的"占位骨架"，不接路由、不跑 `next build`。

## 3. 禁止事项

- 禁止加业务路由 / 业务页面 / 业务组件；本仓不出产品 UI。
- 禁止手写 DDL；`shared/sql/migrations/V*.sql` 是真源。
- 禁止提交 `generated/` 下产物；只 commit emit 脚本与 schema 报告。
- 禁止把 `pg` 移到 `dependencies`；它必须留在 `devDependencies`（不污染消费方 runtime）。
- 禁止手改 `src/db/schema.ts` 添加 PG 表；sqlite smoke 仅 L4 用，PG 表一律由 emit 产物镜像。
- 禁止先改代码后改 `docs/functions/function-tree.md`；改功能与改清单必须同一 commit。
- npm 依赖一律走 `registry.npmmirror.com`。

## 4. 指向别处

- SSOT（DDL 真源） → `../lab-management-system-shared/sql/migrations/`
- 契约 / OpenAPI 同步 → `../lab-management-system-shared/generated/openapi/openapi.yaml`
- 借 pg 消费方 → `../lab-management-system-shared/scripts/sync-db.mjs`
- 功能清单 → `docs/functions/function-tree.md`
- 决策背景 → `docs/adr/`

## 5. 工作循环

1. `npm install`（仅一次，提供 `pg` 与 sqlite 驱动，让 L1..L4 绿）
2. `node scripts/borrow-pg.mjs` — 验证 pg 借链与 PG 可达
3. `node scripts/emit-schema.mjs` — 跑 SSOT emit，写 `generated/`
4. `python scripts/gate.py -p lab-management-system-nextjs`
