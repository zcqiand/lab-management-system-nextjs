# CLAUDE.md — 实验室管理系统Next.js全栈

> 书稿配套仓 + harness 门禁仓双身份。入口，不是手册。L0 门强制上限 60 行。
> 本仓为《（书稿信息待补）》案例（待补）的可运行配套工程，是书稿代码块的 **source of truth**。

## 1. 项目定位

实验室管理系统的 Next.js 全栈仓，双角色：

1. **前端**：消费 shared OpenAPI（`src/api/` orval + axios），AppShell + SidebarNav + M01 合同管理页面
2. **后端**：`src/app/api/auth/*` M00 auth 路由 + `/api/contracts/*` 业务路由（数据来自 msw 仓 fixtures）
3. **infra 副作用**：`scripts/emit-schema.mjs` 等 emit 链 + `generated/`（gitignored）

## 2. 铁律

- **TDD**：先写失败测试 → 确认红 → 实现 → 确认绿 → commit
- **版本钉死**：依赖与 `version-lock.json` 的 `version_lock` 一致；不引入 lock 外的库
- **tag 即放行**：全量回归绿后打 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`（如 `v0.3.54-20260826`）
- **功能清单是锚点**：改 function-tree 走 `/tree-change`；同 commit；废弃只改状态，编号不复用
- **禁手写 DDL**：`shared/sql/migrations/V*.sql` 是真源
- **禁提交 `generated/`**（gitignored；`npm run gen:shared` / emit-schema 重出）
- **禁 `pg` 升 dependencies**（sync-db.mjs 借链不能进消费方 runtime bundle）
- npm 依赖一律走 registry.npmmirror.com

## 3. 技术栈与版本（钉死于 version-lock.json）

Next.js 15 App Router + TS 5.7 + Tailwind v4 + Drizzle PG + pg + jose + orval(axios)。明细见 `version-lock.json`。

门禁命令见 `.harness/stack.json`。**不要改它来让门变松。**

## 4. 验收

- suite 根目录跑 `python scripts/gate.py -p lab-management-system-nextjs`
- `npm run gen:shared` → `node scripts/borrow-pg.mjs` 验证借链

## 5. 指向别处

- SSOT（DDL） → `../lab-management-system-shared/sql/migrations/`；契约 → 同仓 `generated/openapi/`
- 家族兄弟 → react / vue / msw / springboot / aspnetcore
- 决策 → `docs/adr/`；细则 → `docs/conventions/`；待办 → `PLAN.md`；版本 → `CHANGELOG.md`

## 6. 工作循环

1. 读 `.state/session.json`；最小改动
2. gate exit 1 修；exit 2 停下问人
3. `/handoff` 更新 `.state/session.json`
