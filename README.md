# 实验室管理系统 · Next.js 全栈

建筑工程实验室管理系统的 Next.js 全栈前端（App Router）—— 前端 UI + API routes + schema emit infra。

本仓为《Next.js 从入门到项目实战》案例一「实验室管理系统」（第 28-34 章，另第 41 章测试策略跨仓取材本仓）的案例仓，书稿代码块挂本仓 source= 锚点（章节映射见下）。

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

### 书一《Next.js 从入门到项目实战》

- 书稿定位：案例一「实验室管理系统」，第 28-34 章正文代码块挂本仓 source= 锚点；第 41 章「测试策略」跨仓取材本仓 vitest 体系；第 42 章为概念收官章（无摘码）
- 书稿绑定 tag：`v0.3.86-20260926`（指向 xr-know-004 fn 源锚点提交 e10c075，src/ 与当前 HEAD 一致；正文 source= 锚点文件均在该 tag 内）

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

### 书二《Claude Code 从入门到项目实践》（卷三）

- 书稿定位：xr-know-002，第 27、28、29、30、31、32、33 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.3.86-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 27 | 需求规约与项目初始化 | `src/components/app/app-shell.tsx` + `src/components/app/tenant-switcher.tsx` + `src/components/app/sidebar-nav.tsx` |
| 28 | 架构决策与生成约束 | `src/api/legacy-client.ts` + `src/app/api/test-records/route.ts` |
| 29 | 领域建模与数据库接入 | `src/features/inspection-capability/InspectionCapabilityFormModal.tsx` |
| 30 | 任务拆解与核心编码 | `src/features/flow-pipeline/flow-stages.ts` + `src/features/reports/ReportReviewPage.tsx` + `src/features/flow-pipeline/FlowStagePage.tsx` + `src/features/reports/ReportApprovePage.tsx` + `src/features/reports/ReportIssuePage.tsx` + `src/features/reports/ReportArchivePage.tsx` |
| 31 | 测试驱动与缺陷自动修复 | `src/features/receipts/ReceiptList.tsx` + `src/features/task-assignment/TaskAssignmentPage.tsx` + `src/features/reports/ReportReviewPage.tsx` + `src/app/(console)/contracts/page.tsx` |
| 32 | 版本控制与提交管理 | `src/features/summary/SummaryPage.tsx` |
| 33 | 本地构建与交付复盘 | `src/features/receipts/ReceiptDetailPage.tsx` |

### 书三《Codex 从入门到项目实践》

- 书稿定位：xr-know-003，第 28、29、30、31、32、33、34 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.3.86-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 28 | 产品定位与首版范围 | `src/app/(console)/layout.tsx` + `src/app/api/auth/menus/route.ts` |
| 29 | 功能蓝图与优先级 | — |
| 30 | 数据骨架与核心模型 | `src/features/inspection-capability/CalculationMethodList.tsx` + `src/features/inspection-capability/TechnicalRequirementList.tsx` |
| 31 | 基础数据先行 | `src/features/dicts/CategoryDictList.tsx` |
| 32 | 检测能力从无到有 | `src/features/inspection-capability/InspectionCapabilityPage.tsx` |
| 33 | 第一次端到端走通 | `src/features/data-entry/DataEntryPage.tsx` + `src/features/task-assignment/TaskAssignmentPage.tsx` + `src/state/flowStore.ts` + `src/features/flow-pipeline/FlowStagePage.tsx` + `src/features/receipts/ReceiptDetailPage.tsx` |
| 34 | 上线验收与产品复盘 | `src/features/inspection-capability/ParamInterfaceList.tsx` + `src/features/inspection-capability/ParamInterfacePreviewModal.tsx` |

### 书四《Pi 从入门到项目实践》

- 书稿定位：xr-know-017，第 28、29、30、31、32、33、34、35、36 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.3.87-20261004`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 28 | 七仓家族中的 lab 仓定位 | — |
| 29 | schema 变更链 | `src/features/data-entry/SampleExtFieldsModal.tsx` |
| 30 | 预约模块 | `src/features/receipts/ReceiptList.tsx` |
| 31 | 资源管理与联动 | `src/features/dicts/CategoryDictList.tsx` + `src/features/task-assignment/TaskAssignmentPage.tsx` + `src/state/flowReducer.ts` + `src/state/flowStore.ts` + `src/state/transitions.ts` |
| 32 | 跨仓协同 | `src/api/legacy-client.ts` |
| 33 | 复杂缺陷攻坚 | `src/app/api/test-records/route.ts` + `src/features/data-entry/DataEntryPage.tsx` |
| 34 | 慢查询定位优化 | `src/features/summary/SummaryPage.tsx` |
| 35 | 工程化沉淀 | — |
| 36 | 双仓复盘与工作流 | — |

### 书五《OpenCode 从入门到项目实践》（卷四）

- 书稿定位：xr-know-018，第 25、26、27、28、29、30、31、32、33 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.3.86-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 25 | 项目一启动 | `src/app/api/auth/menus/route.ts` + `src/components/app/sidebar-nav.tsx` |
| 26 | 脚手架与数据模型落地 | `src/features/inspection-capability/InspectionCapabilityFormModal.tsx` |
| 27 | 核心业务模块（一） | `src/app/(console)/contracts/page.tsx` + `src/api/legacy-client.ts` |
| 28 | 核心业务模块（二） | `src/features/receipts/ReceiptList.tsx` + `src/components/app/app-shell.tsx` + `src/components/app/tenant-switcher.tsx` |
| 29 | 前端组件体系与页面打磨 | `src/features/flow-pipeline/FlowStagePage.tsx` + `src/features/dicts/CategoryDictList.tsx` + `src/features/summary/SummaryPage.tsx` |
| 30 | 用 OpenCode 建测试防线 | `src/features/task-assignment/TaskAssignmentPage.tsx` + `src/state/flowReducer.ts` + `src/state/flowStore.ts` + `src/state/transitions.ts` + `src/features/flow-pipeline/FlowStagePage.tsx` |
| 31 | 调试实战 | `src/app/(console)/layout.tsx` + `src/components/app/app-shell.tsx` |
| 32 | 容器化与 CI 上线 | — |
| 33 | 项目一收官 | — |
## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
