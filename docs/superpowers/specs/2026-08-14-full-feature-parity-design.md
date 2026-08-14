# lab-management-system-nextjs 全量功能补全 — 设计 spec

> 日期：2026-08-14
> 状态：待用户审阅
> 参考 UI：`backup/lab-management-system`（React REF，下称 REF）
> 决策记录：后端 = msw 为主（nextjs API routes 维持 auth/contracts/saas/health 现状）；功能树 = 完整镜像 REF 194 行；L4 db.smoke 修复与开发并行。

## 1. 目标与非目标

### 目标

- lab-nextjs 前端达到与 REF 的 UI/功能对等：13 个 feature 域全部落地
- 功能树从 33 行扩到 194 行（镜像 REF 全树，含已废弃行），已上线 ID 通过 tree-change 分波推进
- L0–L5 全绿、0 软告警；fnTest 覆盖对齐 REF 的挂 ID 方式
- 数据层走 4-backend 切换（默认 msw），与既有 M98 接线层兼容

### 非目标

- nextjs 自身作后端的 61 条业务路由（本次不做，后续按需逐模块补）
- aspnetcore / springboot 后端的联调验证（切换能力已有，真后端对齐另立任务）
- REF 中「已废弃」功能的复活（镜像行保持已废弃状态）

## 2. 架构决策

### 2.1 数据层：apiClient 适配（方案 A 忠实移植）

REF 组件保留 zustand store + `apiClient`(axios) 调用风格。本仓提供适配：

- REF `src/api/client.ts` 的 `apiClient` → 本仓 `src/api/http-client.ts` 已有的 axios 实例（baseURL 由 backend-switcher 决定，默认 msw）
- `setToken` / `onUnauthorized` / `resetApiClient` 三个导出原样保留（authStore 依赖）
- `identityClient`（saas 身份平台 4 端点）→ 同样走 http-client，baseURL 取 `NEXT_PUBLIC_IDENTITY_BASE_URL`（默认 `/api`，测试走 msw）
- orval `src/api/endpoints/` 产物**不删不重写**：类型（`endpoints.schemas.ts`）供本仓自有代码引用；函数闲置可接受（Wave 6 复查是否收敛）

### 2.2 路由映射

REF react-router → Next.js App Router 文件路由（全部 client components）：

| REF 路由 | Next 路由 | 组件来源 |
| --- | --- | --- |
| /login | 不做本地登录页（委托 saas，见 2.2.1） | — |
| /sso-callback | 不做（同上） | — |
| /dashboard | src/app/dashboard/page.tsx | pages/Dashboard |
| /contracts | src/app/contracts/page.tsx | 已有（核对） |
| /receipts, /receipt/:id | src/app/receipts/page.tsx, src/app/receipts/[id]/page.tsx | features/receipts |
| /task-assignment, /data-entry | 同名目录 | features/task-assignment, data-entry |
| /report-{review,approve,issue,archive} | 同名目录 | features/reports |
| /summary | src/app/summary/page.tsx | features/summary |
| /models, /specifications, /grades, /brands | 4 个 dict 目录 | features/dicts/CategoryDictList |
| /inspection/* 5 页 | src/app/inspection/… | features/inspection-capability |

- 删除 catch-all `[...path]/page.tsx`（功能页就位后无死链；Wave 6 确认无引用再删）
- 路由守卫：REF `ProtectedRoute` → App Router 下改为每个页面包 `<Protected>` client 组件（或 layout 级 guard + `usePathname`），行为三态对齐 REF（未登录→login / 角色不符→403 / 放行）
- `data-fn` / `@entry` 注释锚点随组件原样移植（L5 依赖）

### 2.2.1 认证：不做本地登录页，委托 saas（用户决策 2026-08-14）

REF 的 `Login.tsx` / `SsoCallback.tsx`（用户名密码表单 + 回调页）**不移植**。本仓 `/login` 维持现有「SSO orchestrator」形态：未登录 → `authSsoAuthorize` 拿 authorizeUrl → 直接 `window.location` 跳 saas 身份平台登录页；saas 带 token/code 回 `/login` → 存 token 跳 `/`。即：

- 不出现本仓自有的账号密码表单（REF features/auth/Login.tsx 不进本仓）
- `/sso-callback` 路由不建（code+state 直接回 `/login` 解析，现有逻辑已覆盖）
- 功能树上 M01.F05 的「JWT 登录（用户名+密码）」相关子项在本仓保持镜像行但状态不推「已上线」（登录 UI 在 saas 侧）；SSO/会话同步/登出子项按实际落地推

### 2.3 依赖增量

dependencies：`zustand`、`docx-preview`、`docxtemplater`、`pizzip`
devDependencies：`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`、`msw`、`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`（REF devDeps 里的测试/UI 辅助）
一律 `--registry=https://registry.npmmirror.com`。

### 2.4 报告预览引擎

`features/data-entry/reportTemplateData|Render|Seed` 三件套 + docx-preview/docxtemplater/pizzip 原样移植。模板文件从 `@lab/management-system-msw` 的 `./templates` exports 取（该仓已镜像 30 docx + inject.json，本仓 devDep 已挂）。

### 2.5 状态与 store

zustand store（authStore/receiptStore/sampleStore/contractStore/auditStore/flowStore）原样移植到 `src/state/`（本仓已有该目录）。REF `src/types/` 全量拷入（types 不改动，历史教训：不增不减）。

## 3. 功能树与 tree-change

- Wave 1 一次性提案：镜像 REF 194 行全树（M00–M06 全模块 I 级 + 已废弃行 + 模块总览），加上本仓已有的 M97/M98 保留段
- 状态初始值对齐 REF 当前状态（99 已上线 / 已废弃照抄），本仓新落地前保持「规划」，每波结束按实际落地批量推「已上线」（tree-change 走人批准，不可 echo y）
- 镜像源以 REF `docs/functions/function-tree.md` 为准，不改写措辞

## 4. 测试策略

- REF 70 个测试文件按目录结构对应移植到 `tests/`（jsdom 环境需在 vitest.config 挂 environmentMatchGlobs 或按文件 `// @vitest-environment jsdom`）
- fnTest 挂 ID 机制沿用本仓 `tests/fn.ts` + fnReporter（trace_cmd 产出 trace.json，禁手写）
- 已知的 REF 坑提前规避：vitest 无 auto-cleanup → 同文件多 render 的测试补 `beforeEach(cleanup)`；`testTimeout` 提到 10s；seed ID 含空格要 `encodeURIComponent`
- L4 db.smoke（PG hookTimeout 10s）并行修：先诊断 lab_dev 是否可达（borrow:pg:sibling sanity），hookTimeout 提到 30s 或跳过条件化（改测试需先说明理由——理由：本地 PG 冷启动慢于默认 hook 超时，属测试基建参数非断言放宽）

## 5. 分波交付（每波 gate exit 0 才进下一波）

1. **Wave 1 基建**：依赖 + apiClient 适配 + types/state 拷入 + 功能树镜像提案 + L4 db.smoke 修复
2. **Wave 2 流程线 M03**：receipts + samples + task-assignment + data-entry（含报告预览）+ reports 4 页 + flow-pipeline + audit
3. **Wave 3 M06 检测能力**：inspection-capability 10 组件
4. **Wave 4 M04 字典 + M05 汇总 + Dashboard**
5. **Wave 5 M00/M01/M02 收口**：SSO orchestrator 链路核对（跳 saas / token 回跳）+ 动态菜单 + 路由守卫 + contracts 核对（Wave 前已按 REF 去掉详情面板）
6. **Wave 6 收口**：catch-all 清理 + orval 闲置复查 + fnTest 覆盖对齐 + L5 软告警清零 + handoff

## 6. 风险与对策

| 风险 | 对策 |
| --- | --- |
| REF 组件依赖 vite 特有（import.meta.env） | 移植时改 `process.env.NEXT_PUBLIC_*`，集中在一个 env.ts 适配点 |
| docx 模板加载路径差异（vite public → Next） | 模板走 npm exports 而非 public 目录，统一 import |
| Next 15 + React 19 与 REF 某些库版本冲突 | 依赖装完先 tsc --noEmit 再动手 |
| 功能树镜像与 check_align 跨仓校验冲突 | Wave 1 提案前先跑 `--align --scope=lab` 预检 |
| 大量拷贝触发 L0/L1 结构门 | 每波拷完即跑 gate，不攒 |

## 7. 验收标准

- `python scripts/gate.py -p lab-management-system-nextjs` exit 0，L0–L5 全绿
- 功能树 194+33 行（镜像 + M97/M98），与 REF 对齐检查绿
- 0 软告警；trace.json 覆盖全部已上线 ID
- 手动冒烟：登录 → 接样 → 分配 → 录入 → 预览报告 → 审核/批准/发放/归档 → 汇总，全流程在 msw 后端下可走通
