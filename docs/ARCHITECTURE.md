# lab-management-system-nextjs Architecture

> 子仓级架构文档。回答三个问题：
> 1. 为什么这个 nextjs 仓**同时是 Frontend + DB-First schema 消费层**（与 saas-nextjs 的全栈形态有何不同）；
> 2. 双角色的目录骨架、各层职责、关键文件长什么样；
> 3. 一次「改 shared schema → migrate → 本仓 pull + commit」和一次「前端 dev」分别怎么走。

> **范围**：本文档只描述 *架构*（结构 / 边界 / 数据流 / 决策）。
> 编码细则见 [docs/conventions/](conventions/)（不进主上下文），单个决策的 ADR 见 [docs/adr/](adr/)，需求见 [docs/requirements/](requirements/)。
> 与父仓架构的关系见文末[附录 A](#附录-a与父仓-docsarchitecturemd-的关系)。

---

## 0. 阅读路径

| 你是… | 直接看 |
|---|---|
| 新人，要 30 分钟搞懂本仓 | §1 → §2.1 → §3.3 → §4.2 |
| 想知道「和 saas-nextjs 差在哪」 | §1 → §6.1 → [父仓 ARCHITECTURE.md §4.3](../../../docs/ARCHITECTURE.md#43-前端仓reactvuenextjs--6-仓) |
| 改了 shared schema 怎么把镜像 pull 回来 | §4.2 → §3.3 |
| 改了 shared OpenAPI 怎么 orval | §4.1 → §3.2 |
| 想知道借出去的 `pg` driver 怎么用 | §4.3 → §3.4 |
| 想问「为什么这么设计」 | §6 → 对应 ADR |

---

## 1. 双角色定位

**lab-management-system-nextjs 是一个 nextjs 仓，但身兼两角：lab 家族的「前端 3/3」+ 家族的「DB-First schema 消费层 + pg 借链 host」。** 这个双角色是它与 `saas-identity-platform-nextjs`（Frontend + Backend + DB 三合一全栈）最关键的区别。

### 1.1 与 saas-nextjs 全栈形态的差异

| 维度 | saas-identity-platform-nextjs | lab-management-system-nextjs（本仓） |
|---|---|---|
| 角色 | Frontend + Backend + DB（[ADR-0008](../../../docs/adr/0008-nextjs-full-stack.md)） | Frontend + **DB-First schema 消费层**（ADR-0025/ADR-0033，消费 shared SSOT） |
| DB 在哪个仓 | 本仓的 `src/db/`（Drizzle PG schema，**本仓就是真源**） | **真源在 shared** `src/db/schema.ts`——本仓 `pull-schema.sh` 从真库 pull 镜像入 git |
| Auth 后端 | 本仓 5 个 M00 auth 路由 + 4 个 OAuth + /me/tenants + /admin + /health | **本仓 5 个 M00 auth 路由**（M98.F03 家族定位要求）+ 业务路由 |
| 业务路由数据源 | 本仓 `src/db/` | **`@lab/management-system-msw/fixtures`**（in-memory，nextjs-self 模式） |
| 借出的 runtime | 无 | **`pg` devDep**——被 shared replay 测试借（[§3.4](#34-pg-借链保留的-infra-角色)） |
| 真正的数据持久 | 本仓 `src/db/index.ts` 走 postgres-js | **不持久**——nextjs-self 模式走 fixtures；`src/db/index.ts` 仅 pull/smoke 自检 |

一句话总结：**saas-nextjs 是「把后端活干了」，lab-nextjs 是「从真库 pull schema 镜像入 git」+「前端 3/3」。**

> 历史：本仓曾是家族的「schema emit infra 仓」（replay V*.sql + pg_dump + DBML 三件套，M97.F01）。
> ADR-0025/ADR-0033 切 DB-First 后该角色整体退役（M97.F01 已废弃），见 §3.3。

### 1.2 双角色的两个核心闭环

```
┌─────────────────── lab-management-system-nextjs ──────────────────────┐
│                                                                     │
│  角色 A ─ Frontend ─────────────  角色 B ─ DB-First schema 消费层     │
│  ┌────────────────────────┐              ┌────────────────────────┐ │
│  │ src/app/(console)/...   │              │ scripts/pull-schema.sh │ │
│  │  ├─ page.tsx 业务页     │              │  ├─ drizzle-kit pull   │ │
│  │  └─ src/components/app  │              │  │  真库 → schema.ts    │ │
│  │     ├─ AppShell         │              │  ├─ fix-pulled-schema  │ │
│  │     └─ SidebarNav       │              │  ├─ git diff drift 检测│ │
│  │ src/app/api/auth/*      │              │  └─ ADR-0026 marker    │ │
│  │  (M00 auth + M98.F03)   │              │  产物 src/db/schema.ts │ │
│  │ src/app/api/contracts/* │              │     （入 git）          │ │
│  │  (业务路由 → msw fixtures)             │ scripts/borrow-pg.mjs  │ │
│  │ orval → src/api/        │              │  └─ 验证 pg devDep 借链│ │
│  │     endpoints/endpoints │              └────────────────────────┘ │
│  └────────────────────────┘                                          │
│                    ▲                              ▲                  │
│                    │                              │                  │
└────────────────────┼──────────────────────────────┼──────────────────┘
                     │                              │
       nextjs-self / msw-http / 真后端      shared src/db/schema.ts → migrate → lab_dev
       （ADR-0014 env 切）                  （shared 仓禁 runtime 依赖）
                                            借本仓 node_modules/pg
```

| 角色 | 闭环 | 触发命令 |
|---|---|---|
| **Frontend** | `next dev` 渲染 (console)/* 页面 → apiclient 调后端 → 后端返 fixture / 真数据 → UI 渲染 | `npm install` → `npm run gen:shared` → `npm run dev` |
| **DB-First schema 消费层** | shared 改 `src/db/schema.ts` → migrate 到 lab_dev → 本仓 `pull-schema.sh` pull 真库 → `src/db/schema.ts` 入 git（drift 即显式 commit） | `npm run pull:schema`（包内带 `npm run fix:schema`） |

**关键约束**：两个角色**不能互相打扰**——Frontend 的 L3 typecheck 必须过、pull 链产物必须与真库一致（drift 即显式 commit，不静默吞）；任何一方挂了都不允许拖累另一方。

---

## 2. 目录骨架

```
lab-management-system-nextjs/
├── CLAUDE.md                   ← 入口：双角色 + 禁止事项 + 指向别处（L0 上限 60 行）
├── .harness/stack.json         ← nextjs profile：L1 prettier / L2 eslint / L3 tsc / L4 vitest
├── docs/
│   ├── functions/function-tree.md   ← BASE F 级镜像 + 26 个 BASE F + M97/M98 模块
│   ├── adr/                    ← 本仓特有 ADR（**当前为空**，见 §6.2）
│   ├── design/                 ← design-function-map.md + flow-function-map.md
│   ├── requirements/           ← REQ 模板（lab 家族对称）
│   └── conventions/nextjs.md   ← Server vs Client 组件 / Route Handler / Server Action
├── scripts/
│   ├── gen-shared.ts           ← npm run gen:shared：shared emit:openapi + 本仓 orval + ADR-0026 marker
│   ├── pull-schema.sh          ← npm run pull:schema：drizzle-kit pull 真库 → src/db/schema.ts + drift 检测
│   ├── fix-pulled-schema.mjs   ← npm run fix:schema：修 drizzle-kit pull 产物的两类已知缺陷
│   ├── borrow-pg.mjs           ← npm run borrow:pg：自检（pg 可加载 + lab_dev 可达）
│   ├── borrow-from-nextjs-pg.mjs ← npm run borrow:pg:sibling：sibling 仓外部 reach 入口
│   ├── dump-db.mjs             ← src/seeds 快照 dump（prod bootstrap / 灾备）
│   ├── seed-db.ts              ← msw fixtures → lab_dev 灌数据
│   └── seed-from-snapshot.mjs  ← src/seeds/*.json → 目标 PG（prod bootstrap 反方向）
├── src/
│   ├── app/
│   │   ├── (console)/          ← 业务路由分组（合同/接样/检测/报告/码表/能力）
│   │   │   ├── layout.tsx      ← AppShell 包裹
│   │   │   ├── page.tsx        ← 首页
│   │   │   ├── contracts/      ← M02
│   │   │   ├── receipts/       ← M03.F01 接样
│   │   │   ├── task-assignment/   ← M03.F02
│   │   │   ├── data-entry/         ← M03.F03
│   │   │   ├── report-{review,approve,issue,archive}/   ← M03.F05-08
│   │   │   ├── models/, specifications/, grades/, brands/   ← M04.F06-09
│   │   │   ├── summary/            ← M05.F01
│   │   │   └── inspection-{specialties,objects,parameters,standards,calculation-methods,technical-requirements,param-interfaces}/
│   │   │                          ← M06.F01-08
│   │   ├── api/
│   │   │   ├── auth/           ← M00 + M98.F03 5 个 auth 路由 + SSO 状态
│   │   │   │   ├── login/      ← POST /api/auth/login
│   │   │   │   ├── me/         ← GET /api/auth/me
│   │   │   │   ├── logout/     ← POST /api/auth/logout
│   │   │   │   ├── refresh/    ← POST /api/auth/refresh
│   │   │   │   ├── switch-tenant/   ← POST /api/auth/switch-tenant
│   │   │   │   ├── sso/        ← OAuth 2.0 authorize + callback
│   │   │   │   ├── menus/      ← GET /api/auth/menus（ADR-0009 saas 快照）
│   │   │   │   └── permissions/   ← GET /api/auth/permissions
│   │   │   ├── contracts/, calculation-methods/, catalog/, receipts/, samples/,
│   │   │   ├── inspection/, param-interfaces/,
│   │   │   ├── report-names/, summary/, technical-requirements/, test-records/,
│   │   │   └── health/         ← GET /api/health
│   │   ├── login/page.tsx      ← 登录页（server component）
│   │   ├── globals.css
│   │   ├── icon.svg
│   │   └── layout.tsx          ← root layout
│   ├── components/
│   │   ├── app/
│   │   │   ├── app-shell.tsx   ← sidebar + content + header + 登出按钮
│   │   │   ├── sidebar-nav.tsx ← 菜单按 appCode 过滤 + 图标 string→lucide 映射 + 可收起
│   │   │   ├── backend-badge.tsx
│   │   │   └── login-form.tsx
│   │   ├── ui/                 ← shadcn-ui 底座（Button / Dialog / Input / ...）
│   │   └── ConfirmModal.tsx
│   ├── api/
│   │   ├── backend-config.ts   ← getApiBaseUrl() / getApiMode()（ADR-0014 env 驱动）
│   │   ├── env.ts              ← NEXT_PUBLIC_* env 一处读
│   │   ├── http-client.ts      ← axios + installHttpClient 拦截器
│   │   ├── contracts.ts        ← apiclient 入口（聚合 endpoints）
│   │   ├── legacy-client.ts    ← 历史 client（保留）
│   │   ├── mutator/custom-fetch.ts ← orval mutator（axios 1.7+ strict-mode 类型兼容）
│   │   └── endpoints/          ← orval codegen 产物（gitignored，spec §2.1 tags-split）
│   │       ├── <tag>/<tag>.ts  ← 13 个 @tag 子目录（按 shared tsp 拆）
│   │       └── model/<schema>.ts ← schemas 集中目录（1 schema 1 文件）
│   ├── lib/
│   │   ├── api-helpers.ts      ← 通用 helper（响应解析、错误归一）
│   │   ├── auth/               ← auth 域 lib
│   │   │   ├── config.ts       ← 登录态、回调 URL 白名单
│   │   │   ├── directory.ts    ← 登录目录解析（多用户、多租户）
│   │   │   ├── factory.ts      ← auth-context 工厂
│   │   │   ├── helpers.ts      ← token 校验、tenant 提取
│   │   │   ├── jwt.ts          ← jose HS256 真签发（prod 替换 dev echo）
│   │   │   ├── menu-snapshot.ts← 菜单快照缓存（ADR-0009 saas snapshot）
│   │   │   ├── saas.ts         ← 调 saas 身份平台反代
│   │   │   └── state-cookie.ts ← httpOnly cookie 工具
│   │   ├── catalog-handlers.ts ← M06 码表读写
│   │   ├── db-map.ts           ← DB↔domain 映射
│   │   ├── db-queries.ts       ← pg 复杂查询封装
│   │   └── utils.ts            ← cn() 等小工具
│   ├── db/
│   │   ├── index.ts            ← postgres-js driver（仅 pull/smoke 自检 + src 内查询，非 nextjs-self 路径）
│   │   └── schema.ts           ← pull-schema.sh 产物（**入 git**，真库镜像，禁手改表结构）
│   ├── data/                   ← 静态 fixture 资源（demo seed 兜底）
│   ├── features/               ← 业务 feature 模块（按 M 拆分）
│   ├── seeds/                  ← 业务种子数据
│   ├── state/                  ← Zustand store + auth-context
│   └── types/                  ← 跨模块类型
├── tests/
│   ├── db.smoke.test.ts        ← 验 shared target DDL 可执行（lab_smoke 隔离 schema）
│   ├── fn.ts                   ← fnTest helper（fn-ID 嵌入 it 名称）
│   ├── fnReporter.ts           ← vitest reporter → .state/trace.json
│   ├── setup.dom.ts + setup.ts
│   ├── server-only.stub.ts
│   ├── api/  components/  features/  helpers/  integration/  lib/  types/
├── generated/                  ← orval codegen 产物（gitignored；openapi/）
├── public/                     ← 静态资源（favicon / icons）
├── deploy/
│   ├── docker-entrypoint.sh    ← container 启动脚本
│   ├── lab-management-system-nextjs.sh
│   ├── nginx-vps.conf.example
│   └── setup-vps.sh
├── tools/                      ← dev 辅助脚本
├── next.config.ts              ← Next.js 配置
├── drizzle.config.ts           ← drizzle-kit pull 配置（PG dialect；PG_* env，无 fallback 密码）
├── orval.config.ts             ← orval codegen 配置（axios-functions + mutator）
├── vitest.config.ts
├── eslint.config.js
├── tsconfig.json
├── components.json             ← shadcn-ui 配置
├── Dockerfile                  ← multi-stage build + runner
├── .env.example / .env.local / .env.production
└── package.json
```

---

## 3. 核心模块

### 3.1 Frontend 层（`src/app/(console)/` + `src/components/` + `src/api/`）

**职责**：渲染业务页面、接 apiclient 调后端、组合业务组件。

| 子模块 | 文件 | 职责 |
|---|---|---|
| 页面层 | `src/app/(console)/<route>/page.tsx` | 一级菜单对应页面（M02-M06 各模块）；默认 server component，交互下沉 `*-client.tsx` |
| 业务组件 | `src/components/app/app-shell.tsx` | sidebar + content + header + 登出按钮骨架；token / backend 状态展示 |
| 业务组件 | `src/components/app/sidebar-nav.tsx` | 菜单按 `appCode=NEXT_PUBLIC_LAB_APP_CODE` 过滤；图标从 string → lucide 组件映射；可收起（持久到 localStorage） |
| 业务组件 | `src/components/app/backend-badge.tsx` | 显示当前后端模式（msw-http / aspnetcore / springboot）——ADR-0014 仅展示用 |
| 业务组件 | `src/components/app/login-form.tsx` | 登录表单 |
| UI 底座 | `src/components/ui/` | shadcn-ui 组件（Button / Dialog / Input / Select / DropdownMenu / Checkbox ...） |
| 通用组件 | `src/components/ConfirmModal.tsx` | 通用确认弹窗 |
| 客户端入口 | `src/api/backend-config.ts::getApiBaseUrl() / getApiMode()` | ADR-0014 env 驱动的 3 getter（`NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_MODE`） |
| HTTP 客户端 | `src/api/http-client.ts::installHttpClient(getToken)` | axios 拦截器——启动时注入 baseURL + Authorization header（**必须调一次**，否则 prod 走同 origin 被 nginx 405，详见 `memory/orval-axios-baseurl-must-be-installed.md`） |
| Orval 客户端 | `src/api/endpoints/<tag>/<tag>.ts` + `model/<schema>.ts` | 由 `npm run gen:shared` 产出；**gitignored**；`custom-fetch` mutator 解 AxiosResponse 外壳；spec §2.1 tags-split 形态 |
| Auth 状态 | `src/state/auth-context.tsx` + `src/lib/auth/*` | 登录态 / 选租户 / SSO callback 跳转 |

**与 saas-nextjs AppShell 的差异**：
- 不引 `TenantProvider`（lab-nextjs 没有 tenant 概念，只有 auth-context）；
- 菜单从后端 `/api/auth/menus` 拉（[ADR-0009](../../../docs/adr/0009-db-credentials-env.md) saas 快照缓存 → demo 兜底）；
- 应用名从 saas 公共目录 `/api/v1/apps/[code]`（免鉴权）拉，不写死在客户端。

### 3.2 BFF 路由层（`src/app/api/`）

**职责**：作为 nextjs-self 模式的后端，5 个 M00 auth 路由 + 业务路由（fixture backed）。这部分是 [M98.F03 家族定位要求](functions/function-tree.md#m98-frontend-接线层) 的功能，**不是产品代码**。

#### 3.2.1 M00 auth 路由

| 路由 | 方法 | M98.F03 子项 | 数据源 | 备注 |
|---|---|---|---|---|
| `/api/auth/login` | POST | I01 | 内存 mock（demo 3 租户） | 真路径接 pg |
| `/api/auth/me` | GET | I02 | 内存 mock | 返回 user + tenants[] + currentTenantId |
| `/api/auth/logout` | POST | I03 | 无 | 204 No Content |
| `/api/auth/refresh` | POST | I04 | 无 | refreshToken → token |
| `/api/auth/switch-tenant` | POST | I05 | 内存校验 | 换发带 tenant_id claim 的 token |
| `/api/auth/sso/{authorize, callback}` | GET/POST | （M01.F05.I03） | 调 saas /api/v1/oauth/* | client_secret 后端持 + state CSRF |
| `/api/auth/menus` | GET | （M01.F04.I04） | saas snapshot cache | ADR-0009 miss 回退 demo 树 |
| `/api/auth/permissions` | GET | （M01.F05.I04） | saas 反代 | |

> **何时走本仓 nextjs-self vs 走真后端**：`.env` 的 `NEXT_PUBLIC_API_BASE_URL=""`（默认同源）时，apiclient 命中本仓 `app/api/*`；改成 `http://localhost:5200` 走 lab-msw；改成 `http://localhost:5205` 走 springboot 真后端（[ADR-0014](../../../docs/conventions/multi-repo-family.md#4-后端配置env-driven-单-urladr-0014)）。

#### 3.2.2 业务路由

`src/app/api/{contracts, calculation-methods, catalog, receipts/{7 阶段 act}, samples, inspection, param-interfaces, report-names, summary, technical-requirements, test-records, health}/`

> 2026-09-17 SSOT 清理：`org-info`（静态数据常量化 `src/features/data-entry/org-info.ts`）、
> `audit-logs`（功能删除）、`receipts/flow`(+`flow/queue`)（私生端点，迁 7 阶段 act 契约端点）已删除。

| 路由示例 | 数据源 | 备注 |
|---|---|---|
| `GET/POST /api/contracts` | `@lab/management-system-msw/fixtures` | `contracts[]` in-memory |
| `GET/POST /api/receipts` | msw fixtures | `receipts[]` + 分页 + flowStatus 过滤 |
| `GET /api/test-records?sampleId=&receiptId=` | msw fixtures | M03.F03.I08 |
| `POST /api/test-records` | msw fixtures | M03.F03.I09 |
| `GET /api/health` | 无 | 返 `{ok:true}` |

**关键约束**：

- 业务路由**不连真 PG**——nextjs-self 模式下数据全在 msw fixtures（同进程内存）；
- `src/db/index.ts`（postgres-js driver）**仅供 DB-First 链自检**（`db.smoke.test.ts` 验 shared target DDL），不参与请求处理；
- 真生产部署切 `NEXT_PUBLIC_API_BASE_URL=http://<springboot-host>:5205` 走 springboot 后端，本仓 API routes 仅在 nextjs-self 模式生效。

### 3.3 DB-First schema 消费层（`scripts/`）

**职责**：从真库把 DDL 结构反推（`drizzle-kit pull`）为本仓 `src/db/schema.ts` 入 git（ADR-0025/ADR-0033，镜像 saas-nextjs）。原「emit 三件套」（replay V*.sql + pg_dump + DBML）随 Flyway 退役删除（M97.F01 已废弃）。

| 脚本 | 入口 | 关键产物 | 触发 |
|---|---|---|---|
| `pull-schema.sh` | `npm run pull:schema` | `src/db/schema.ts`（入 git）+ drift 检测 + ADR-0026 marker | shared 改 schema 并 migrate 后跑 |
| `fix-pulled-schema.mjs` | `npm run fix:schema` | 修 pull 产物 `.default(')` / unused `sql` 两类缺陷 | pull-schema.sh 内部自动调（step 3） |
| `borrow-pg.mjs` | `npm run borrow:pg` | 仅打印 `pg version` + `SELECT 1` | L4 smoke 路径同款自检 |
| `borrow-from-nextjs-pg.mjs` | `npm run borrow:pg:sibling` | 同上 | sibling 仓从外部 reach 入口 |

#### 3.3.1 pull 链（`pull-schema.sh` 流程）

```
真库 lab_dev（结构由 shared src/db/schema.ts migrate 而来）
  ↓ npx --no drizzle-kit pull --config drizzle.config.ts
  ↓ 产物 drizzle/schema.ts（drizzle-kit pull 默认输出目录）
  ↓ move → src/db/schema.ts
  ↓ fix-pulled-schema.mjs（幂等）：
  │   1. `.default(')` → `.default('')`：pull 对 text NOT NULL DEFAULT '' 列丢引号
  │   2. import 列表 / 独立整行的 unused `sql`
  ↓ rm -rf drizzle/（relations.ts 等辅助文件不要）
  ↓ git diff src/db/schema.ts——漂移即 exit 1（DB 真演进或本地未同步，需显式 commit）
  ↓ ADR-0026 marker：.state/last-gen-shared.json 写 db_synced_sha
OK → src/db/schema.ts 与 git HEAD 一致
```

**已知 pull 保真度限制**（不修，ORM 查询无感）：遗留约束名（`param_interfaces_pkey` 等）pull 会丢（渲染成列级 `.primaryKey()`）；真名以 shared schema.ts / 真库为准。

### 3.4 `pg` 借链（保留的 infra 角色）

**关键事实**：`shared` 仓禁 npm runtime 依赖（[ADR-0007](../../../docs/adr/0007-shared-sql-ssot.md)），但其 `tests/drizzle.replay.test.ts`（空库 push 重建断言）需要 `pg` driver。**借链策略**：

| 优先级 | 来源 | 场景 |
|---|---|---|
| 1 | `../lab-management-system-nextjs/node_modules/pg` | dev 路径——**本仓就是首选借出方** |
| 2 | `../saas-identity-platform-nextjs/node_modules/pg` | saas 家族 dev（备选） |

**对本仓的硬约束**：

- `pg` 必须落 `devDependencies`（**不能升 dependencies**）——借链不能进消费方 runtime bundle；
- `borrow-pg.mjs` 自检 = pg 可加载 + lab_dev 可达（验证借链完整）；
- `borrow-from-nextjs-pg.mjs` 是 sibling 仓外部 reach 入口（镜像 saas-nextjs 的同款脚本）。

---

## 4. 核心流程

### 4.1 dev 流程（Frontend 角色）

```
1. cd output/lab-management-system-nextjs
   npm install
   → 安装 next / react / axios / drizzle / pg（devDep） / orval / drizzle-kit / shadcn-ui / ...

2. npm run gen:shared
   → scripts/gen-shared.ts: spawnSync('npm run emit:openapi', cwd=../lab-management-system-shared)
     shared 仓 tsp compile → generated/openapi/openapi.yaml
   → spawnSync('npx orval', cwd=本仓)
     本仓 orval.config.ts:
       input  = ../lab-management-system-shared/generated/openapi/openapi.yaml
       output = ./src/api/endpoints/ (mode=tags-split, client=axios-functions, spec §2.1)
       override.mutator = custom-fetch（axios 1.7+ strict-mode 类型兼容）
   → 产出 src/api/endpoints/<tag>/<tag>.ts + model/<schema>.ts（gitignored）

3. node scripts/borrow-pg.mjs
   → require("pg") 加载自本仓 node_modules/pg
   → Client → SELECT 1 → 确认 lab_dev 可达（pg 借链 + 网络）

4. npm run dev
   → next dev :5201
   → src/app/(console)/* 渲染业务页
   → src/app/api/auth/* 5 个 M00 auth 路由就绪
   → src/app/api/contracts/* 业务路由 → @lab/management-system-msw/fixtures 返数据
   → http-client.ts::installHttpClient() 注入 baseURL=getApiBaseUrl()
   → 浏览器调 axios → http://localhost:5200（NEXT_PUBLIC_API_BASE_URL 默认值）
     → lab-msw :5200 处理（GET /healthz → mode:"msw"）
   → 浏览器渲染（shadcn-ui + Tailwind v4）

5. （可选）python scripts/gate.py -p lab-management-system-nextjs
   → L1 prettier / L2 eslint / L3 tsc --noEmit / L4 vitest run
   → exit 0 = 全绿；1 = 按 fix 提示回代码改
```

**关键检查点**：

- **`gen:shared` 必须跑过**，否则 `src/api/endpoints/` 空、orval 类型缺失、L3 typecheck 红；
- **`installHttpClient` 必须调一次**，否则 prod 永远走同 origin 被 nginx 405（`memory/orval-axios-baseurl-must-be-installed.md`）；
- **`baseURL` 是 root URL，不带 `/api/v1` 前缀**——path 自带 prefix（`memory/axios-baseurl-no-path-prefix.md`）；
- **`.env` 用 `registry.npmmirror.com`**（CLAUDE.md 顶层约束）；
- **后端 CORS allowlist 必须含 3000**（nextjs dev）——msw 已硬编码白名单（lab-msw: nextjs(3000) + react/vue(5173) + 对侧 saas-msw(5174)）。

### 4.2 schema 同步流程（infra 角色，DB-First）

```
A. 改 shared DB schema（家族任何人，经 /tree-change 审批链）
   ../lab-management-system-shared/src/db/schema.ts
   ↓ npm run db:generate（物化 drizzle/）→ gate 绿 → commit
   ↓ npm run migrate-db（应用迁移到 lab_dev）

B. cd output/lab-management-system-nextjs
   bash scripts/pull-schema.sh
   ↓ drizzle-kit pull 真库 → src/db/schema.ts（fix + drift 检测 + ADR-0026 marker）
   ↓ drift = DB 真演进 → git add src/db/schema.ts && git commit

C. npm test
   → tests/db.smoke.test.ts 验 shared target DDL 可执行（lab_smoke 隔离 schema）

D. （可选）父仓推进本仓 gitlink
   cd ..  # suite 根
   git update-index --add --cacheinfo 160000,<NEW_HASH>,output/lab-management-system-nextjs
   chore(submodule): 推进 lab-management-system-nextjs 指针
   ↓ git push
```

**关键检查点**：

- **`src/db/schema.ts` 必须入 git**——CI / 新 clone 不再有任何 pull 步骤；
- pull 报 drift = DB 真演进或本地未同步，确认后显式 commit（这正是 DB-First 工作流）；
- 禁止手改 `src/db/schema.ts` 的表结构（它是真库的镜像，改结构 = 改 shared schema.ts）。

### 4.3 pg 借链流程（跨仓）

```
A. shared 仓需要 pg driver 跑 replay 测试（无 runtime dep，禁装）
   ↓ ../lab-management-system-shared/tests/drizzle.replay.test.ts
   ↓ createRequire('../lab-management-system-nextjs/package.json') → 本仓 node_modules/pg

B. 本仓 dev 自检
   cd output/lab-management-system-nextjs
   npm run borrow:pg
   → scripts/borrow-pg.mjs:
     1. createRequire(resolve(<nextjsRoot>, 'package.json'))
     2. require('pg')
     3. new Client({...}) → SELECT 1
     4. 返 OK + pg version
   → exit 0 = 借链可用；1 = 没装；2 = 装上但连不上

C. L4 smoke 同款路径
   tests/db.smoke.test.ts
   → 验证 pg 可加载 + shared target DDL 可执行
   → trace.json 报 fn-ID（M97.F02.I02）
```

**关键检查点**：

- **本仓 `pg` 必须留 devDependencies**——升 dependencies 会污染消费方 runtime bundle；
- sibling 仓外部 reach 入口：`scripts/borrow-from-nextjs-pg.mjs`（镜像 saas-nextjs 同款脚本）。

---

## 5. 关键基建（8 个核心文件）

| # | 路径 | 角色 | 关键事实 |
|---|---|---|---|
| 1 | `CLAUDE.md` | 入口 | L0 上限 60 行；双角色声明 + 5 类禁止事项 + 4 个指向别处 + 5 步工作循环 |
| 2 | `.harness/stack.json` | 门禁自描述 | nextjs profile：L1 prettier / L2 eslint / L3 tsc / L4 vitest；trace_cmd=`npx vitest run`；trace_env=`TRACE_MAP=1` |
| 3 | `src/api/backend-config.ts` | ADR-0014 env 入口 | `getApiBaseUrl()` / `getApiMode()`；`isMswEnabled()` 已删除（ADR-0012 v0.3.0） |
| 4 | `src/api/http-client.ts` | axios 拦截器 | `installHttpClient(getToken)`——bootstrap **必须调一次**；返 `ApiError`（含 status + body） |
| 5 | `src/api/mutator/custom-fetch.ts` | orval mutator | `.then(r => r.data)` 解 AxiosResponse 外壳 + `as unknown as Promise<TData>` 桥接 strict mode |
| 6 | `orval.config.ts` | orval codegen | `axios-functions` 客户端 + `tags-split` 模式（spec §2.1）+ custom mutator；输出 `src/api/endpoints/<tag>/<tag>.ts` + `model/<schema>.ts` |
| 7 | `drizzle.config.ts` | drizzle-kit pull 配置 | PG dialect；PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE 全走 env（禁默认值兜底，密码由 pull-schema.sh fail-fast 校验）；无 schema 字段（pull 不读 schema.ts） |
| 8 | `scripts/pull-schema.sh` | DB-First pull 链主入口（`npm run pull:schema`） | 5 步：pull → move src/db/schema.ts → fix → git diff drift 检测 → ADR-0026 marker |
| 9* | `scripts/fix-pulled-schema.mjs` | pull 产物后处理 | 修 `.default(')` → `.default('')` + unused `sql` import；幂等 |
| 10* | `scripts/borrow-pg.mjs` | pg 借链自检 | 验证 `require("pg")` + `SELECT 1`；L4 smoke 同款路径 |

> 标 `*` 为最核心补充——`fix-pulled-schema` 缺失则 `src/db/schema.ts` tsc 红；`borrow-pg` 缺失则 shared replay 测试借链断。

---

## 6. 决策索引

### 6.1 父仓 ADR（12 份，按主题分组）

| ADR | 主题 | 对本仓的影响 |
|---|---|---|
| [0001](../../../docs/adr/0001-suite-owns-l0-and-l5.md) | suite 保留 L0 / L5 | 本仓 `.harness/stack.json` 只能声明 L1-L4 |
| [0002](../../../docs/adr/0002-trace-json-as-cross-language-anchor-contract.md) | trace.json 是跨语言锚点 | L4 vitest 跑 `TRACE_MAP=1` 产 `.state/trace.json`；禁止手写 |
| [0003](../../../docs/adr/0003-function-tree-requires-human-approval.md) | 功能清单变更需人批 | M01 起业务页要先 `/tree-change` 翻状态再 commit |
| [0005](../../../docs/adr/0005-defense-in-depth-for-protected-paths.md) | 受保护路径纵深防御 | `.claude/hooks/` 不让改；本仓也不能放宽 |
| [0007](../../../docs/adr/0007-shared-sql-ssot.md) | shared 仓扩到双 SSOT | 本仓消费 DB SSOT 的历史起点；ADR-0025 之后真源形态变为 shared `src/db/schema.ts` |
| [0008](../../../docs/adr/0008-nextjs-full-stack.md) | saas-nextjs 兼全栈 | 本仓**不兼**全栈——本仓是 Frontend + DB-First 消费层，saas-nextjs 才是 Backend+DB |
| [0009](../../../docs/adr/0009-db-credentials-env.md) | DB 凭据走 env | `PG_*` / `DATABASE_URL` 走 env，deploy 烘焙；pull 链与借链自检共用 |
| [0012](../../../docs/adr/0012-msw-as-http-server.md) | msw 仓升级为独立 HTTP 服务 | dev 默认 `NEXT_PUBLIC_API_BASE_URL=http://localhost:5200`（lab-msw） |
| [0014](../../../docs/conventions/multi-repo-family.md#4-后端配置env-driven-单-urladr-0014)（隐含 ADR） | env-driven 单 URL | 废弃 BackendSwitcher + localStorage；本仓 `backend-config.ts` 反映该决议 |

### 6.2 本仓 ADR（当前为空）

`docs/adr/` 目录当前**空**——本仓特有决策（如 pull 链的 drift 检测为什么用 `git diff` 而不是 hash 比对）目前散落在 `scripts/pull-schema.sh` / `scripts/fix-pulled-schema.mjs` 文件 header 和 `tests/db.smoke.test.ts` 注释中。**TODO**：随 DB-First 链定型，逐步把以下决策沉淀为 ADR：

| 候选主题 | 当前散落位置 | 拟文件名 |
|---|---|---|
| drizzle-kit pull 两类已知缺陷的 fix 链 | `scripts/fix-pulled-schema.mjs` | `0001-fix-pulled-schema.md` |
| orval `custom-fetch` mutator（axios 1.7+ strict-mode 兼容） | `src/api/mutator/custom-fetch.ts` header | `0002-orval-custom-fetch-mutator.md` |
| 借 `pg` devDep 链（为何本仓是 shared replay 测试的首选借出方） | `docs/adr/0000-borrow-pg-as-devdep.md`（候选） | `0000-borrow-pg-as-devdep.md` |

### 6.3 与 saas-nextjs 全栈形态的差异（关键说明）

| 维度 | saas-nextjs | **lab-nextjs（本仓）** |
|---|---|---|
| Backend in仓 | ✅ `src/app/api/v1/{auth,oauth,me,admin,health}` | ✅ 5 个 M00 auth 路由 + 业务路由（fixture backed） |
| DB in仓 | ✅ `src/db/`（postgres-js + Drizzle PG）**+ 本仓即真源** | ⚠️ `src/db/schema.ts` 在本仓但是 **pull 镜像**（真源在 shared） |
| DB 持久 | ✅ 真持久（saas_dev / saas_prod） | ❌ nextjs-self 模式全在内存 |
| DB-First pull 链 | ✅ `pull-schema.sh`（pull 自己的真源） | ✅ `pull-schema.sh`（pull shared SSOT migrate 出的真库） |
| 借 pg | ❌ 无 | ✅ **lab 家族首选借出方**（shared `tests/drizzle.replay.test.ts` 第一优先级即本仓） |
| M97 模块 | ❌ 无 | ⚠️ F01 emit 链已废弃（ADR-0033）；F02 借链保留（服务 shared replay 测试） |
| M98.F01 4-backend | ✅ 已废弃（ADR-0014） | ✅ 已废弃（ADR-0014） |
| M98.F02 http-client 注入 | ✅ | ✅ |
| M98.F03 Next.js API routes | ✅ Backend 形态（含 OAuth + /me + /admin + /health） | ✅ **仅 5 个 M00 auth 路由**（family-positioning 要求，非产品代码） |
| M03-M06 业务路由 | ❌（走真后端） | ✅（走 msw fixtures） |

**一句话**：saas-nextjs 是「把后端活干了」；lab-nextjs 是「pull shared schema 镜像入 git」+「前端 3/3」。两者的 Next.js App Router 是同一套骨架，但内里**承担的角色完全不一样**。

---

## 7. 术语表

| 术语 | 含义 | 详细 |
|---|---|---|
| **双角色** | Frontend + DB-First schema 消费层 | 本仓定位；与 saas-nextjs 全栈三角色（Frontend+Backend+DB）形成对照 |
| **DB-First pull 链** | `pull-schema.sh`：真库 → drizzle-kit pull → src/db/schema.ts 入 git | ADR-0025/ADR-0033；原 emit 三件套角色已退役（M97.F01 废弃） |
| **ADR-0026 marker** | `.state/last-gen-shared.json` 记 db_synced_sha | pull-schema.sh 末步写入；check_align staleness 检查用 |
| **lab_smoke schema** | db.smoke.test 的隔离 schema | `SET search_path TO lab_smoke`，验 shared target DDL 可执行，不污染 public |
| **pg devDep 借链** | shared replay 测试借本仓 node_modules/pg | 两段 fallback（本仓 → saas-nextjs）；禁升 dependencies |
| **nextjs-self 模式** | `NEXT_PUBLIC_API_BASE_URL=""`（同源）时，apiclient 命中本仓 API routes | M98.F03；走 msw fixtures |
| **MSW** | Mock Service Worker；本仓 dev 默认走独立 HTTP server `:5200`（ADR-0012 B 强度） | `GET /healthz → {mode:"msw"}` |
| **ADR-0014** | env-driven 单 URL 配置 | 废弃 4-backend 运行时切换；改 `NEXT_PUBLIC_API_BASE_URL` / `_API_MODE` |
| **BASE F 级镜像** | 契约仓的 F 级原样到本仓 | 本仓 function-tree.md §BASE F 级（M00-M06 + M97/M98） |
| **REF 镜像** | BASE F 级下的 I 级子项 | 从 REF（backup/lab-management-system）抄，只收父 F ∈ BASE 的行 |
| **JWT（HS256）** | RFC 7519 access token 真签发（lab 本仓签的 dev key；prod 走 saas 真签 + jose verify） | 本仓 `src/lib/auth/jwt.ts` 持 jose HS256 真签发；dev/prod 同代码路径，仅 `JWT_SIGNING_KEY` 来源不同 |
| **TenantGuard** | 路径 tenantId vs JWT claim 校验 | 本仓 M98.F03.I05 在 switch-tenant 路由里隐式校验 |
| **stack.json** | 项目自描述（栈 + 门配置） | suite 门禁读它，本仓只能声明 L1-L4 |
| **trace.json** | 测试命中 fn-ID 的清单 | `trace_cmd` 产，禁止手写 |
| **fnTest** | 测试 ID 嵌入 it 名称的模式 | `fnTest(["M01.F05.I01"], "desc", () => {...})` |
| **gitlink** | 父仓对子仓 commit hash 的引用 | mode 160000；详见父仓 `docs/conventions/submodule.md` |

---

## 附录 A：与父仓 `docs/ARCHITECTURE.md` 的关系

**本文档不重复父仓内容**——它**聚焦本仓的双角色特殊性**。如下信息请回到父仓 ARCHITECTURE.md 查看：

| 主题 | 在父仓的位置 |
|---|---|
| 14 仓家族全景 + 角色矩阵 | 父仓 §1, §2.2 |
| 双 SSOT 原则（API 契约 + DB schema） | 父仓 §3.1 |
| 一份契约三套 codegen 通用规则 | 父仓 §3.2 |
| 端口与 CORS 全景表 | 父仓 §3.5, §6 |
| msw = 独立 HTTP 服务（B 强度） | 父仓 §3.6 |
| Function Tree 跨端对齐原则 | 父仓 §3.7 |
| 14 仓各自 CLAUDE.md 一览 | 父仓 §9 |
| 12 份 ADR 索引 | 父仓 §7 |

**本仓特有的、本文档独有**：

1. **双角色定位**（§1）——本仓是家族里唯一的 Frontend + DB-First schema 消费层双角色仓；
2. **DB-First pull 链**（§3.3, §4.2）——`pull-schema.sh` + `fix-pulled-schema.mjs` 镜像 saas-nextjs（本仓独有 extra fix 步）；
3. **pg 借链**（§3.4, §4.3）——本仓是 shared `tests/drizzle.replay.test.ts` 的**首选借出方**；
4. **nextjs-self 模式下业务路由走 msw fixtures**（§3.2.2）——与 saas-nextjs 真持久化形成对照。

---

## 附录 B：典型陷阱（详见 `~/.claude/.../memory/`）

| 陷阱 | 后果 | 解法 |
|---|---|---|
| orval + axios 没 installHttpClient 拦截器 | prod 永远走同 origin 被 nginx 405 | `main.tsx` bootstrap 调 `installHttpClient` |
| axios baseURL 含 `/api/v1` 前缀 | path 前缀重复 | baseURL 是 root URL；path 自带 prefix |
| 改了 shared schema.ts 没重 pull | 本仓 `src/db/schema.ts` stale，check_align 报 marker 过期 | `bash scripts/pull-schema.sh`（或 `npm run pull:schema`）+ commit |
| drizzle-kit pull 后没跑 fix:schema | `src/db/schema.ts` 编译失败 / 运行时炸 | pull-schema.sh 内部自动跑；手动重跑用 `npm run fix:schema` |
| pg devDep 升 dependencies | 消费方 runtime bundle 污染 | 留 `devDependencies`；shared replay 测试借链不能进 bundle |
| 改 M01 起业务页前没走 `/tree-change` | L5 红 / 评审失败 | 先 `/tree-change` 提案 → commit 同一批 |
| `gen-shared` 跑过但 endpoints/ 还没出 | L3 typecheck 红 + apiclient 找不到 | `npm run gen:shared` 后 `git status` 看 `src/api/endpoints/` |
| 后端 CORS allowlist 漏 3000 | 浏览器 preflight 莫名失败 | nextjs dev 默认跨源；msw/server.ts 已硬编码白名单 |
| borrow-pg exit 2 | 网络错 / env 错 | 检查 `PG_HOST` / `PG_PASSWORD` / `PG_DATABASE`；CI 需配 env |
