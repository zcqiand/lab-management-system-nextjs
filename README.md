# 实验室管理系统 · Next.js 全栈

建筑工程实验室管理系统的 Next.js 全栈前端（App Router）—— 前端 UI + API routes + schema emit infra。

本仓为《（书稿信息待补）》案例（待补）的可运行配套工程，是书稿代码块的 **source of truth**。

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

| 章 | 主题 | 对应源文件 |
| :--- | :--- | :--- |
| （待补） | | |

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
