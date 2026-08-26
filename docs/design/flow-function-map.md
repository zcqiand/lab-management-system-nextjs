# 流程与功能对齐 — 建筑工程实验室管理系统-Next.js

> 人填、人评审。机器只检查引用的功能 ID 是否存在。
> 评审时把流程图投出来，逐行念「这一步靠哪些功能完成」。念不出来的行，
> 要么流程是空的，要么功能是缺的。这就是对齐的全部意义。

## FLOW-01 试验过程主流程（接样 → 归档）

```mermaid
flowchart LR
    S01[接样] --> S02[任务分配]
    S02 --> S03[数据录入]
    S03 --> S04[报告审核]
    S04 --> S05[报告批准]
    S05 --> S06[报告发放]
    S06 --> S07[报告归档]
    S04 -- 驳回 --> S03
    S05 -- 驳回 --> S03
    S07 --> S08[详情查看]
```

| 步骤 | 名称 | 角色 | 输入 | 输出 | 状态流转 | 支撑功能子项 |
|---|---|---|---|---|---|---|
| S01 | 接样 | 接样员 | 委托单 + 样品信息 | sample_receipt + samples | `pending` → `submitted` | M03.F01.I01, M03.F01.I02, M03.F01.I03, M03.F01.I04, M03.F01.I06, M03.F01.I07 |
| S02 | 任务分配 | 任务分配员 | sample_receipt | sample_receipt.assignee/date | `submitted` → `assigned` | M03.F02.I01, M03.F02.I02, M03.F02.I03, M03.F02.I04 |
| S03 | 数据录入 | 检测员 | 样品 + 检测项目 | test_records | `assigned` → `data_entered` | M03.F03.I01, M03.F03.I02, M03.F03.I03, M03.F03.I04, M03.F03.I06, M03.F03.I07 |
| S04 | 报告审核 | 审核员 | sample_receipt + 检测数据 | sample_receipt.flowStatus | `data_entered` → `review_passed` 或 驳回 → `data_entered` | M03.F05.I01, M03.F05.I02, M03.F05.I03, M03.F05.I04 |
| S05 | 报告批准 | 批准人 | sample_receipt | sample_receipt.flowStatus | `review_passed` → `approved` 或 驳回 → `data_entered` | M03.F06.I01, M03.F06.I02, M03.F06.I03, M03.F06.I04 |
| S06 | 报告发放 | 发放员 | sample_receipt | sample_receipt.flowStatus | `approved` → `issued` | M03.F07.I01, M03.F07.I02, M03.F07.I03, M03.F07.I04 |
| S07 | 报告归档 | 档案员 | sample_receipt | sample_receipt.flowStatus | `issued` → `archived` | M03.F08.I01, M03.F08.I02, M03.F08.I03, M03.F08.I04 |
| S08 | 详情查看 | 任意角色 | sample_receipt.id | 完整详情页 | – | M03.F09.I01, M03.F09.I02, M03.F09.I03 |

### 评审时问这四个问题

1. 有没有哪个步骤的「支撑功能子项」是空的？→ 功能缺失，或这一步不该存在
2. 有没有功能子项从头到尾没出现在任何流程里？→ 见下方孤儿清单
3. 状态流转列里的状态名，和代码里的枚举一致吗？→ 不一致就是两套真相
4. 退回路径都画了吗？→ 只画正向流程，会漏掉一半功能

### 孤儿功能

不在任何流程里但合法的功能。**没解释的孤儿 = 没人要的功能。**

| 功能 ID | 为什么合法 |
|---|---|
| M02.F01.I01 | 合同管理是上游资源池，所有接样单通过 contractId 引用；本身不参与流程转换 |
| M02.F01.I02 | 同上（合同新建/编辑） |
| M02.F01.I03 | 同上（合同删除；与试验流程解耦） |
| M98.F01.I01 | ~~运行时后端切换 UI 下拉~~已废弃（ADR-0014） |
| M98.F01.I02 | ~~baseURL 持久化到 localStorage 跨标签同步~~已废弃（ADR-0014）；baseURL 改由 NEXT_PUBLIC_API_BASE_URL 部署期配置 |
| M98.F02.I01 | axios 拦截器在 baseURL = getApiBaseUrl() 上自动跑；infra 副作用，不参与业务流程 |
| M98.F03.I01 | POST /api/auth/login 是 nextjs-backend-mode 下的认证入口；M00 选租户前置 |
| M98.F03.I02 | GET /api/auth/me 给 M00.F01（当前用户会话）提供数据 |
| M98.F03.I03 | POST /api/auth/logout 走侧栏登出按钮（M01.F05.I05） |
| M98.F03.I04 | POST /api/auth/refresh 走 axios 拦截器（M98.F02.I01） |
| M98.F03.I05 | POST /api/auth/switch-tenant 给 M00.F02（登录选租户）提供后端 |
| M05.F01.I01 | 试验报告汇总表：按报告名称（categoryCode）聚合 sample_receipts，是流程末端读视图（不参与状态流转） |
| M06.F05.I01 | 计算方法维护是 M06 字典子域，被数据录入（M03.F03）读取，但本身不参与流程状态 |
| M06.F05.I02 | 同上（计算方法新建/编辑） |
| M06.F05.I03 | 同上（计算方法删除） |
| M06.F06.I01 | 技术要求维护是 M06 字典子域，被数据录入（M03.F03）读取，但本身不参与流程状态 |
| M06.F06.I02 | 同上（技术要求新建/编辑） |
| M06.F06.I03 | 同上（技术要求删除） |
| M06.F07.I01 | 报告名称维护是 M06 字典子域，被接样（M03.F01.I07 ext 字段补录）+ 数据录入读取 |
| M06.F07.I02 | 同上（报告名称新建/编辑） |
| M06.F07.I03 | 同上（报告名称删除） |
| M06.F07.I04 | 同上（关联检测项目） |
| M06.F07.I05 | 同上（关联检测依据 role=TESTING） |
| M06.F07.I06 | 同上（关联判定依据 role=JUDGMENT） |
| M06.F07.I07 | 同上（关联检测参数） |
| M06.F07.I08 | 同上（报告名称扩展属性维护） |
| M06.F08.I01 | 参数界面维护是 M06 字典子域，被数据录入（M03.F03 录入卡路由）读取，但本身不参与流程状态 |
| M06.F08.I02 | 同上（参数界面新建/编辑） |
| M06.F08.I03 | 同上（参数界面删除） |
| M06.F08.I05 | 同上（参数界面预览） |
| M06.F08.I06 | 同上（参数界面预览弹窗） |
| M04.F06.I01 | 型号码表维护是 M04 基础数据子域，被接样（M03.F01 样品型号下拉）读取，但本身不参与流程状态 |
| M04.F06.I02 | 同上（型号新建/编辑） |
| M04.F06.I03 | 同上（型号删除） |
| M04.F07.I01 | 规格码表维护是 M04 基础数据子域，被接样（M03.F01 样品规格下拉）读取，但本身不参与流程状态 |
| M04.F07.I02 | 同上（规格新建/编辑） |
| M04.F07.I03 | 同上（规格删除） |
| M04.F08.I01 | 等级码表维护是 M04 基础数据子域，被接样（M03.F01 样品等级下拉）读取，但本身不参与流程状态 |
| M04.F08.I02 | 同上（等级新建/编辑） |
| M04.F08.I03 | 同上（等级删除） |
| M04.F09.I01 | 牌号码表维护是 M04 基础数据子域，被接样（M03.F01 样品牌号下拉）读取，但本身不参与流程状态 |
| M04.F09.I02 | 同上（牌号新建/编辑） |
| M04.F09.I03 | 同上（牌号删除） |
| M97.F01.I01 | 发射脚本 replay 段：从 `../lab-management-system-shared/sql/migrations/V*.sql` 在 lab_dev 全量回放，dev 期 schema emit 基建，无 UI 无权限 |
| M97.F01.I02 | 发射脚本 dump 段：用 catalogDump / pg_dump --schema-only 把 lab_dev 真实表结构输出成 `generated/schema.sql`，dev 期 schema emit 基建 |
| M97.F01.I03 | 发射脚本 pull 段：跑 drizzle-kit pull 出 TS schema 到 `generated/schema.ts`，再过 `scripts/fix-pulled-schema.mjs` 后处理，dev 期基建 |
| M97.F01.I04 | 发射脚本 dbml 段 + `scripts/v-sql-to-dbml.mjs`：把表结构翻成 DBML 写 `generated/schema.dbml`，供文档/ER 图消费 |
| M97.F02.I01 | dev 依赖 `pg ^8.13.1`：必须留 devDependency，sync-db.mjs 借链不能进消费方 runtime bundle（CLAUDE.md §3 硬约束） |
| M97.F02.I02 | `scripts/borrow-pg.mjs` sanity：验证 pg 借链与 lab_dev 可达，L4 smoke 同款路径 |
| M97.F02.I03 | `../lab-management-system-shared/scripts/sync-db.mjs:36-46` createRequire 借用本仓 pg 客户端连 lab_dev；infra 副作用 |

---

## FLOW-02 异常流程（驳回 + 撤回）

```mermaid
flowchart TD
    S04[报告审核] -- 驳回 --> S03[数据录入]
    S05[报告批准] -- 驳回 --> S03[数据录入]
    S02[任务分配] -- 清空分配 --> S02
```

| 步骤 | 名称 | 角色 | 触发条件 | 操作 | 支撑功能子项 |
|---|---|---|---|---|---|
| A01 | 审核驳回 | 审核员 | 报告数据不合格 | flowStatus → `data_entered`，保留 test_records | M03.F05.I03 |
| A02 | 批准驳回 | 批准人 | 报告签发前需改 | flowStatus → `data_entered`，保留 test_records | M03.F06.I03 |

---

## FLOW-03 认证流程（JWT 登录 / SSO 回调 / 登出）

```mermaid
flowchart LR
    S01[未登录访问 /console/*] --> S02{有无 token?}
    S02 -- 无 --> S03[路由守卫: router.replace /login]
    S02 -- 有 --> S04[进业务页]
    S03 --> S05[login-form: POST /api/auth/login]
    S03 --> S06[SSO: 跳 saas 拿 token 回 /login]
    S05 --> S07[写 token + 拉 /auth/permissions]
    S06 --> S07
    S07 --> S04
    S04 --> S08[侧栏 LogOut: authStore.logout → /login]
```

| 步骤 | 名称 | 角色 | 触发条件 | 操作 | 支撑功能子项 |
|---|---|---|---|---|---|
| B01 | 路由守卫 | — | 进 (console)/* 但无 token | router.replace('/login') | M01.F04.I02 |
| B02 | 动态菜单 | — | 进业务页 | 拉 /api/auth/menus（ADR-0009：SSO callback 快照缓存 saas 菜单，miss 回退 demo）渲染侧栏 | M01.F04.I04 |
| B03 | JWT 登录 | 用户 | 在 /login 提交用户名密码 | POST /api/auth/login → 写 token | M01.F05.I01 |
| B04 | Token 校验 | 拦截器 | 任何 API 请求 | 注入 Authorization: Bearer | M01.F05.I02 |
| B05 | SSO 统一登录 | 用户 | 在 /login 走 SSO 入口 | 跳 saas /login 拿 token 回 /login | M01.F05.I03 |
| B06 | 会话同步 | — | SSO 回调拿到 token+user | 写 token + 拉 /auth/permissions 入 user | M01.F05.I04 |
| B07 | 登出 | 用户 | 点侧栏 LogOut | authStore.logout 清 token → /login | M01.F05.I05 |
| A03 | 任务清空 | 任务分配员 | 分配有误 | assignee=null；sample_receipt 保留 | M03.F02.I03 |

### 评审时问这四个问题

1. 有没有哪个步骤的「支撑功能子项」是空的？→ 功能缺失，或这一步不该存在
2. 有没有功能子项从头到尾没出现在任何流程里？→ 见下方孤儿清单
3. 状态流转列里的状态名，和代码里的枚举一致吗？→ 不一致就是两套真相
4. 退回路径都画了吗？→ 只画正向流程，会漏掉一半功能