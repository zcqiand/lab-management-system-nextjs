# lab-management-system-nextjs API routes 接 lab_dev（pg）— 设计 spec

> 日期：2026-08-16
> 状态：待用户审阅
> 前置背景：nextjs 后端模式的 42 个 `/api/*` 业务路由目前数据来自 `@lab/management-system-msw/fixtures`（in-memory），与「nextjs api 对接数据库」的预期不符。本次把数据层切到 lab_dev（PostgreSQL）。
> 决策记录：driver 与 saas-nextjs 完全对齐（postgres-js runtime）；种子灌 msw 同源数据；读写全落库；SQL 重写三态过滤。

## 1. 目标与非目标

### 目标

- nextjs 模式下 42 个业务 API routes 读写 lab_dev（真持久化：重启不丢、刷新不复活）
- `src/db/index.ts` server-only 单例（postgres-js + drizzle），模式照抄 saas-nextjs
- `scripts/seed-db.mjs` 把 msw 种子（26 张 JSON 表 + flow-matrix 派生 210 条 receipts）灌入 lab_dev，幂等可重跑
- driver 布局与 saas-nextjs 完全一致：`postgres` 进 dependencies，`pg` 靠 drizzle-orm 传递依赖存在（删 devDeps 显式声明）
- L0–L5 全绿、0 软告警维持

### 非目标

- auth 5 路由（`/api/auth/*`）维持 mock token demo 语义不动——真接库是 M01 认证整块的事
- aspnetcore / springboot 两仓（未建）
- msw 模式行为零改动（MSW 拦截在浏览器层，与路由代码无关）
- shared 仓 / msw 仓 / react 仓 / vue 仓零改动

## 2. 架构决策

### 2.1 数据流（改造后）

```
浏览器
 ├─ msw 模式        → MSW 拦截（fixtures 内存）        ← 不动
 ├─ aspnetcore      → :5000                            ← 不动（仓未建）
 ├─ springboot      → :8080                            ← 不动（仓未建）
 └─ nextjs 模式     → 本仓 /api/* 路由
                       │ 变化点：api-helpers.ts 不再 import fixtures
                       ▼
                     src/db/index.ts（server-only 单例）
                       postgres-js pool (max 10) + drizzle
                       ▼
                     lab_dev（shared V001-V013 表 + seed-db.mjs 灌数）
```

关键洞察：`/api/*` 路由只在 nextjs 模式被命中（msw 模式拦截在浏览器层，另两个模式打别的服务器），
所以路由代码**无条件接 pg，无双源开关**。界面 BackendSwitcher 4 选 1 与默认 msw 均不变。

### 2.2 driver 双轨 → 对齐 saas 单轨声明

| | saas-nextjs（现状） | lab-nextjs（改后） |
|---|---|---|
| `postgres` (postgres-js) | dependencies ^3.4.5 | **dependencies（新增）** — runtime |
| `pg` | 不声明（node-pg-migrate 传递带入） | **不声明（drizzle-orm 传递带入）** — 借链用 |
| devDeps `pg ^8.13.1` | — | **删除**（已验证 `npm ls pg`：drizzle-orm 传递 8.23.0 deduped 在顶层） |

CLAUDE.md 红线「pg 必须留 devDependencies」**整条删除**，替换为「runtime 数据层只用 postgres-js（见 ADR）」。

风险与收尾验证：删 devDeps 后 shared `sync-db.mjs` 借链依赖 drizzle-orm 传递依赖，
收尾必须实测 `node ../lab-management-system-shared/scripts/sync-db.mjs --incremental` 跑通。

### 2.3 schema 来源：re-export generated

`src/db/schema.ts` 单行 re-export `generated/schema.ts`（emit-schema.mjs 的 drizzle-kit pull 产物，
gitignored、脚本重出）。与 `src/api/endpoints/` 同款消费模式，保持 shared V*.sql 单一真相。
代价：新 clone 后必须先跑 `node scripts/emit-schema.mjs` 才能编译（与 gen:shared 同级别的既有心智）。

### 2.4 三态流转过滤：SQL 重写

`/api/receipts` 的 filter 三态语义（2026-08-16 刚修订过：not_yet = 停在本环节待提交）用 SQL/Drizzle where 表达：

- `not_yet`：`eq(flowStatus, stage)`（无 flowStatus 参数时 = `jsonb_array_length(flow_history) = 0`）
- `submitted`：`ne(flowStatus, stage)` AND `EXISTS (SELECT 1 FROM jsonb_array_elements(flow_history) h WHERE h->>'action'='submit' AND h->>'from'=<stage>)`
- 无 flowStatus 的 submitted 分支：`jsonb_array_length(flow_history) > 0 AND last_submitted_by IS NOT NULL`

`flow_history` 列已是 jsonb（V002 DDL 确认），表达式可行。
语义基线 = lab-msw handler 现行为（注释在 `/api/receipts/route.ts` 头部），集成测试逐分支对齐。

### 2.5 写操作落库

- POST → `insert().returning()`；PUT → `update()`；DELETE → `delete()`
- msw handler 的业务保护（isOfficial 拒删、引用检查拒删）用 SQL WHERE 前置条件表达：
  `DELETE ... WHERE id=$1 AND is_official=false`，受影响 0 行 → 409（保护命中）或 404（不存在）
- 多表写（receipt 更新 + flowHistory append）用 `db.transaction()`

## 3. 组件与文件清单

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/db/index.ts` | 新增 | `server-only` + postgres-js pool (max 10) + drizzle 入口；DATABASE_URL 未设时 throw（saas 同款） |
| `src/db/schema.ts` | 新增 | 单行 re-export `generated/schema` |
| `src/lib/api-helpers.ts` | 改造 | 删 fixtures import；加 row(snake_case)→DTO(camelCase) 映射层（一处定义 42 路由共用）；保留 pageOf/qp/notFound 等纯工具 |
| `src/app/api/**/route.ts`（42 个） | 改造 | 数据读写改 db 查询/落库；业务保护改 SQL WHERE 前置 |
| `scripts/seed-db.mjs` | 新增 | tsx 跑，import msw fixtures（复用 flow-matrix 派生，不双维护），灌 lab_dev |
| `package.json` | 改 | `postgres` 进 deps；devDeps 删 `pg`；scripts 加 `seed:db` |
| `CLAUDE.md` | 改 | §1 后端描述改「数据来自 lab_dev（pg）」；§3 红线 pg 条款替换 |
| `docs/adr/`（新 ADR） | 新增 | driver 对齐 saas 决策 + 无双源开关理由 |
| `docs/functions/function-tree.md` | 走 /tree-change | M98 新增子项（如 M98.F04 pg 数据层 + I 级），批准后动 |

## 4. 种子链路（scripts/seed-db.mjs）

```
@lab/management-system-msw/src/fixtures（26 张 JSON + flow-matrix 派生 210 条）
        │  tsx 直接 import（同一份派生代码）
        ▼
scripts/seed-db.mjs（本仓）
        │  camelCase→snake_case 映射 + FK 顺序编排 + id 校验
        ▼
lab_dev（24 张表）
```

- 幂等：默认 `TRUNCATE ... RESTART IDENTITY CASCADE` 再灌，可重跑（saas 同款）
- FK 顺序按 V011 backwire 拓扑：contracts → sample_receipts → samples → test_records；字典/目录表先于 junction 表
- flow-matrix 派生的 210 条 receipts 一并落库（msw 模式数据完整镜像，对账有意义）
- 灌完打印 fixtures 行数 vs 库行数对账表，不一致 exit 1
- 命令：`npm run seed:db`（tsx + DATABASE_URL，默认 .env 的 lab_dev）
- lab msw 种子 id 均为 text 主键（无 saas 的 UUID 三格式问题，预期不需要 resolveId；实现时若发现例外再补映射）

## 5. 错误处理

- DATABASE_URL 未设 / 连不上 → 503 + JSON body 明确提示「检查 DATABASE_URL / 跑 npm run seed:db」（不让裸异常冒到前端）
- 保护命中（isOfficial / 引用检查）→ 409 + code 字段（与 msw handler 错误形状一致）
- 行不存在 → 404 NOT_FOUND（沿用现有 notFound helper）

## 6. 测试与门禁

| 层 | 做法 |
|---|---|
| 单测（vitest） | row→DTO 映射 + 三态 SQL 条件生成器纯函数单测 |
| 集成 | 新增 `tests/api/pg-crud.test.ts`：直调 route handler，对 lab_dev 跑 GET/POST/PUT/DELETE，select 回读断言落库；跑前自动 seed |
| 门禁 | L4 需 pg 可达（borrow-pg.mjs 已验证同环境）；L0–L3 无影响；fnTest 挂既有 M98 功能 ID，不加新 ID（新 ID 走 tree-change） |
| 手动验收 | 切 nextjs 模式 → 列表有数（来自库）→ DELETE 一条 → psql 查库确认消失 → 刷新仍不存在（与 fixtures 的「刷新复活」形成对比） |

## 7. 风险

| 风险 | 缓解 |
|---|---|
| 删 devDeps pg 后借链断 | 收尾实测 sync-db.mjs --incremental；断了则恢复 devDeps 声明并回滚红线改写 |
| SQL 重写的三态语义与 msw handler 漂移 | 集成测试逐分支对齐 msw handler 行为基线 |
| generated/schema.ts 缺失导致编译失败 | README/CLAUDE.md 已有 gen:shared 前置心智；emit-schema 并入同一 setup 段落 |
| 42 路由一次切换回归面大 | seed 对账 + 集成测试覆盖 CRUD 主干；msw 模式不受影响可随时对照 |
