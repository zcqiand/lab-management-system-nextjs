# 实验室管理系统 · Next.js 全栈

建筑工程实验室管理系统的 Next.js 全栈前端（App Router）—— 前端 UI + API routes + schema emit infra。

本仓为《Next.js 从入门到项目实战》案例一「实验室管理系统」（第 28-34 章，另第 41 章测试策略跨仓取材本仓）的案例仓，书稿代码块挂本仓 source= 锚点（章节映射见下）。

本仓同时作为《Vue从入门到项目实践》（亚马逊电子书）案例一的可运行配套后端工程（真链路 :5201）——该书正文不挂本仓 source= 锚点，其前端代码块的 **source of truth** 为姊妹仓 lab-management-system-vue。

## 快速开始

```bash
npm install            # 安装依赖（提供 pg / drizzle / orval / next）
npm run gen:shared     # shared emit:openapi + 本仓 orval → src/api/endpoints/
npm test               # 全量测试（无 Key / 无 Docker / 无网可跑）
npm run dev            # 本地开发
npm run build          # 生产构建
```

## 功能特性

- **前端**：AppShell + SidebarNav（菜单来自 saas）+ M01 合同管理页面；orval(axios) 调后端
- **后端**：`src/app/api/auth/*` M00 auth 路由 + `/api/contracts/*` 业务路由（msw fixtures 驱动）
- **infra 副作用**：`scripts/emit-schema.mjs` 等 emit 链 + `generated/`（gitignored）
- SSO 对接 saas 身份平台（SAAS_IDP_URL / SAAS_UI_BASE_URL 拆分）

## 技术栈

| 技术 | 版本 |
| :--- | :--- |
| Next.js | ^15.1.0 |
| React | ^19.0.0 |
| @tanstack/react-query | ^5.101.4 |
| Drizzle ORM | ^0.36.4 |
| postgres / pg | ^3.4.9 / ^8.23.0 |
| jose | ^5.10.0 |
| orval（axios client） | ^7.21.0 |
| TypeScript | ^5.7.0 |
| Vitest | ^4.0.0 |

> 依赖版本与 `version-lock.json` 的 `version_lock` 一致，不引入 lock 外的库。

## 配套书籍及章节映射

> 同一案例仓后续接入其他书籍时，在此节下新增书籍小节。

### 《Next.js 从入门到项目实战》（主绑定）

- 书稿定位：案例一「实验室管理系统」，第 28-34 章正文代码块挂本仓 source= 锚点；第 41 章「测试策略」跨仓取材本仓 vitest 体系；第 42 章为概念收官章（无摘码）
- 锚点基线：正文 source= 锚点文件以本仓工作区现行结构（`src/features/`、`src/app/(console)/`）为准，均已核实存在

| 章 | 书稿章节 | 主要取材 |
| :--- | :--- | :--- |
| 28 | 案例立项：实验室管理系统的工程骨架 | app-shell / sidebar-nav、api/auth/menus、orval.config、src/db |
| 29 | SSO 登录：OAuth 授权码流与会话管理 | api/auth/sso/{authorize,callback}、login、auth-context、api 客户端 |
| 30 | 合同管理：第一个业务闭环 | src/api/contracts.ts、api/contracts/route.ts |
| 31 | 接样登记：表单校验与三态过滤器 | features/receipts、api/receipts、flow-pipeline |
| 32 | 任务分配：流程状态机的起点 | features/task-assignment、flow-stages、state/flowStore |
| 33 | 数据录入：动态表单与检测记录 | features/data-entry、api/test-records |
| 34 | 报告六阶段管线与汇总仪表盘 | features/reports、features/summary |
| 41 | 测试策略（跨仓部分） | vitest.config、tests/fn*、tests/api/* |

### 《Vue从入门到项目实践》（亚马逊电子书）

- 书稿基线：书稿正文不挂本仓 source= 锚点（本仓为真链路配套后端 :5201，未按章冻结书稿 tag）；最新 tag `v0.3.86-20260926`
- 书稿定位：案例一「实验室管理系统」配套后端，服务第 34-38 章真链路联调（SSO 身份源为 saas-identity-platform-nextjs）

| 章 | 主题 | 对应源文件 |
| :--- | :--- | :--- |
| 34 | 案例一：项目立项与架构设计 | — |
| 35 | 案例一：认证与权限模块 | — |
| 36 | 案例一：数据管理与业务模块 | — |
| 37 | 案例一：流程引擎与状态机 | — |
| 38 | 案例一：测试与交付 | — |

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
