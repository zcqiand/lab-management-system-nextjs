# 功能清单（Function Tree）— lab-management-system-nextjs

> **全体系唯一锚点。** 需求、流程、设计、测试都引用这里的 ID。
> 不在这里的 ID 是悬空引用，L5 门会拦。**改功能，先改这份表。**

## 编号规则

| 层级 | 名称 | 格式 | 含义 |
|---|---|---|---|
| 一级 | 功能模块 | `M0x` | 业务域边界，通常对应一级菜单（实际命名见各仓模块总览） |
| 二级 | 功能 | `M0x.F0y` | 一个完整业务步骤 / 独立闭环流程 / 数据管理页面 |
| 三级 | 功能子项 | `M0x.F0y.I0z` | 最小操作单元。标签页、查询条件、增删改查/审核/导入导出按钮 |

**硬规则**

1. 编号单调递增，永不复用。废弃改状态，不删行。
2. 子项编号必须以父级为前缀。
3. 一个子项 = 一个权限点。权限码即 ID，不另起一套编码。
4. 拆不出子项的功能 → 它其实是子项，往上并。子项超 20 个 → 它其实是模块，往下拆。

**状态**：`规划` | `开发中` | `已上线` | `已废弃`
**子项类型**：`页面` | `标签页` | `查询` | `按钮` | `报表` | `接口`

## 本仓角色

**Full-stack 前端 + schema emit infra 仓**。Next.js 特殊：既是前端，又可通过 API routes 作后端。

M97 全规划（infra，**没有 UI/data-fn**），M98 含产品切面（4-backend 切换 + Next.js API routes）。
M00..M06 是 shared BASE 镜像（full-feature-parity Task 6）：26 个 BASE F 级原样 + REF 树中挂在这些 F 级下的 I 级子项（父 F ∈ BASE，check_align 合法扩充）。REF 已上线/开发中行在本仓初始「规划」，落地后逐波 tree-change 推进；REF 已废弃行照抄「已废弃」。

---

## 模块总览

| 模块 ID | 模块名称 | 业务域边界 | 状态 |
|---|---|---|---|
| M00 | 租户管理 | 当前用户关联租户列表、登录选租户、切换租户 | 规划 |
| M01 | 认证管理 | 权限管理（RBAC/路由守卫/动态菜单）、认证（登录/SSO/JWT） | 规划 |
| M02 | 资源管理 | 合同管理 | 规划 |
| M03 | 试验过程管理 | 接样 → 任务分配 → 数据录入 → 报告审核 → 批准 → 发放 → 归档 | 规划 |
| M04 | 基础数据 | 型号/规格/等级/牌号维护 | 规划 |
| M05 | 数据统计 | 报告汇总表（按报告名称） | 规划 |
| M06 | 检测能力 | 检测专项/项目/参数/标准/计算规则/技术要求/报告名称/参数界面 | 规划 |
| M97 | schema emit infrastructure | lab-management-system-shared V*.sql → {schema.sql, schema.dbml, schema.ts} + pg 借链 | 规划 |
| M98 | frontend 接线层 | 4-backend 切换 + apiclient + Next.js API routes（自身作后端） | 规划 |

---

## BASE F 级（M0x.F0y，shared BASE 镜像）

| 功能 ID | 功能 | 闭环定义 | 类型 | 状态 |
|---|---|---|---|---|
| M00.F01 | 当前用户会话 | 当前用户信息 + 关联租户列表 + 当前选中租户（GET /auth/me） | 查询 | 规划 |
| M00.F02 | 登录选租户 | 登录后选择租户，换发携带 tenant_id claim 的 token（POST /auth/switch-tenant） | 接口 | 规划 |
| M01.F04 | 权限管理 | RBAC 角色权限、路由守卫、权限指令、动态菜单（身份平台下发） | 接口 | 规划 |
| M01.F05 | 认证管理 | 用户名+密码登录 + SSO 统一登录（对接身份平台），JWT 签发与校验 | 接口 | 规划 |
| M02.F01 | 合同管理 | 合同 CRUD、工程信息维护 | 接口 | 已上线 |
| M03.F01 | 接样管理 | 接样单 CRUD、报告类别关联、流程状态 | 接口 | 已上线 |
| M03.F02 | 任务分配 | 接样提交后安排检测人员/计划日期，提交进入数据录入；任务字段挂 SampleReceipt | 接口 | 已上线 |
| M03.F03 | 数据录入 | 样品检测数据录入 | 接口 | 已上线 |
| M03.F05 | 报告审核 | 报告审核流程 | 接口 | 已上线 |
| M03.F06 | 报告批准 | 报告批准流程 | 接口 | 已上线 |
| M03.F07 | 报告发放 | 报告发放流程 | 接口 | 已上线 |
| M03.F08 | 报告归档 | 报告归档流程 | 接口 | 已上线 |
| M03.F09 | 接样单详情 | 接样单查看（接样信息+样品信息+检测数据） | 接口 | 已上线 |
| M04.F06 | 型号维护 | InspectionModel 实体码表维护，列表按检测专项过滤 | 接口 | 已上线 |
| M04.F07 | 规格维护 | InspectionSpec 实体码表维护，列表按检测专项过滤 | 接口 | 已上线 |
| M04.F08 | 等级维护 | InspectionGrade 实体码表维护，列表按检测专项过滤 | 接口 | 已上线 |
| M04.F09 | 牌号维护 | InspectionBrand 实体码表维护，列表按检测专项过滤 | 接口 | 已上线 |
| M05.F01 | 报告汇总 | 按报告类别输出试验报告汇总表 | 查询 | 已上线 |
| M06.F01 | 检测专项 | InspectionSpecialty CRUD（检测能力字典根） | 接口 | 已上线 |
| M06.F02 | 检测项目 | InspectionObject CRUD + 专项/参数关联 | 接口 | 已上线 |
| M06.F03 | 检测参数 | InspectionParameter CRUD + 标准/参数关联 | 接口 | 已上线 |
| M06.F04 | 检测标准 | InspectionStandard CRUD（含状态：active/superseded/draft） | 接口 | 已上线 |
| M06.F05 | 计算规则 | CalculationRule 维护（复合主键，算法类型 + 公式） | 接口 | 已上线 |
| M06.F06 | 技术要求 | TechnicalRequirement 维护，按四维度匹配；brand/model/grade/spec 改为 FK 引用实体 | 接口 | 已上线 |
| M06.F07 | 报告名称 | InspectionReportName CRUD + extFields 模板 + 关联标准/参数 | 接口 | 已上线 |
| M06.F08 | 参数界面 | ParamInterface 维护 + 参数↔界面 link | 接口 | 已上线 |

---

## M97 schema emit infrastructure

| 功能 ID | 功能名称 | 闭环定义 | 状态 |
|---|---|---|---|
| M97.F01 | emit schema snapshot | 读 shared V*.sql → replay → generated/{schema.sql, schema.dbml, schema.ts} 三件套 | 规划 |
| M97.F02 | lend pg runtime | 持有 `pg` devDep 供 shared/sync-db.mjs `require("pg")` 借 | 规划 |

### M97.F01 emit schema snapshot

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M97.F01.I01 | replay V*.sql to lab_dev | 接口 | 顺序 execute V001..V<N>，每条一个事务；中途失败回滚 | 规划 |
| M97.F01.I02 | pg_dump --schema-only | 接口 | 写到 generated/schema.sql；带 `tenant_id` V012 后的列 | 规划 |
| M97.F01.I03 | drizzle-kit pull | 接口 | 写到 generated/schema.ts；PG dialect | 规划 |
| M97.F01.I04 | v-sql → DBML | 接口 | 写到 generated/schema.dbml；让 msw / 未来 backend 直接对比 ER | 规划 |

### M97.F02 lend pg runtime

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M97.F02.I01 | pg devDep | 接口 | `pg ^8.13.1` 落到本仓 devDependencies（**不是** dependencies） | 规划 |
| M97.F02.I02 | borrow-pg sanity | 接口 | `node scripts/borrow-pg.mjs`：验证 `require("pg")` + 联 lab_dev | 规划 |
| M97.F02.I03 | consumed by shared sync-db | 接口 | `../lab-management-system-shared/scripts/sync-db.mjs:36-46` 借本仓的 pg | 规划 |

---

## M98 frontend 接线层

| 功能 ID | 功能名称 | 闭环定义 | 状态 |
|---|---|---|---|
| M98.F01 | 运行时后端切换（4-backend） | msw / aspnetcore / springboot / nextjs 选择，baseURL 持久化到 localStorage | 已上线 |
| M98.F02 | http-client 注入 | axios 拦截器在 baseURL = getBaseUrl() 上自动跑 | 已上线 |
| M98.F03 | Next.js API routes（自身作后端） | `/api/auth/{login,me,logout,refresh,switch-tenant}` 5 个路由；nextjs-backend-mode 下命中 | 已上线 |

### M98.F01 运行时后端切换

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F01.I01 | BackendSwitcher 下拉 | 按钮 | 4-backend 下拉；data-fn=`M98.F01.I01` 锚点在 src/components/app/backend-switcher.tsx | 已上线 |
| M98.F01.I02 | 持久化 baseUrl | 接口 | localStorage[`lab.backend`]；跨标签 storage 事件同步 | 已上线 |

### M98.F02 http-client 注入

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F02.I01 | axios 拦截器 | 接口 | src/api/http-client.ts 的 installHttpClient；注入 baseURL + Authorization | 已上线 |

### M98.F03 Next.js API routes

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F03.I01 | POST /api/auth/login | 接口 | demo：返 mock token + 3 租户；真路径接 pg | 已上线 |
| M98.F03.I02 | GET /api/auth/me | 接口 | 当面用户 + tenants[] + currentTenantId | 已上线 |
| M98.F03.I03 | POST /api/auth/logout | 接口 | 204 No Content | 已上线 |
| M98.F03.I04 | POST /api/auth/refresh | 接口 | 用 refreshToken 换新 token | 已上线 |
| M98.F03.I05 | POST /api/auth/switch-tenant | 接口 | 校验 tenantId 后换 token；msw 仓的同款语义 | 已上线 |


## BASE I 级（REF 镜像，父 F ∈ BASE）


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M01.F04.I01 | RBAC 角色权限 | 接口 | admin（全部权限）/ technician（受限权限）两级角色 | 已废弃 |
| M01.F04.I02 | 路由守卫 | 接口 | 未登录跳转登录页；角色不匹配跳转 403；三态正确拦截 | 已上线 |
| M01.F04.I03 | 权限指令 | 接口 | 按权限码动态渲染/卸载 UI 元素；无权限元素从 DOM 移除 | 已废弃 |
| M01.F04.I04 | 动态菜单 | 接口 | 侧边栏菜单由身份平台 GET /menus?appId=app-lab 下发，按权限码显隐；分组无可见子项则隐藏 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M01.F05.I01 | JWT 登录 | 接口 | 用户名+密码登录，MSW mock 层签发 JWT token | 已上线 |
| M01.F05.I02 | Token 校验 | 接口 | 请求拦截器注入 Bearer token，token 失效跳转登录 | 已上线 |
| M01.F05.I03 | SSO 统一登录 | 接口 | 授权码流：跳转身份平台授权端点→回调换 token→建立会话；state 校验防 CSRF | 已上线 |
| M01.F05.I04 | 身份会话同步 | 接口 | 用身份平台 token+user 建会话，并从 /auth/permissions 拉取权限集（机构=租户 1:1） | 已上线 |
| M01.F05.I05 | 登出 | 接口 | Layout 侧边栏底部展示当前用户 + 退出按钮：点击调 authStore.logout() 清 token/user 并跳 /login | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M02.F01.I01 | 合同列表 | 接口 | 合同 CRUD | 已上线 |
| M02.F01.I02 | 合同新建/编辑 | 接口 | 合同信息维护 | 已上线 |
| M02.F01.I03 | 合同删除 | 接口 | 合同删除 | 已上线 |
| M02.F01.I04 | 合同汇总 | 接口 | 按合同统计汇总数据 | 已废弃 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F01.I01 | 接样单列表 | 接口 | 创建/查看/编辑/删除接样单，含 categoryCode | 已上线 |
| M03.F01.I02 | 接样单新建 | 接口 | 含 receiptCode/contractId/categoryCode | 已上线 |
| M03.F01.I03 | 接样单编辑 | 接口 | 接样单信息修改 | 已上线 |
| M03.F01.I04 | 接样单删除 | 接口 | 接样单删除 | 已上线 |
| M03.F01.I05 | 接样单详情 | 接口 | 含 flowStatus（待提交/审核中/已批准/已发放/已归档）+ flowHistory | 已废弃 |
| M03.F01.I06 | 接样单三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤接样单列表 | 已上线 |
| M03.F01.I07 | 接样单 ext 字段补录 | 接口 | 报告预览前按当前类别 extFields 弹 SampleExtFieldsModal，补录持久化到 Sample.ext | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F02.I01 | 任务分配 | 接口 | 接样提交后进入分配中，安排检测人员+计划日期 | 已上线 |
| M03.F02.I02 | 任务编辑 | 接口 | 安排弹窗维护 assigneeName/assigneeId/plannedTestDate | 已上线 |
| M03.F02.I03 | 任务取消（清空分配） | 接口 | 清空 assignee/assigneeId/plannedTestDate，把已分配单子在本阶段重置为未分配（非退回接样；退回接样走 FlowStagePage 通用退回按钮） | 已上线 |
| M03.F02.I04 | 任务分配三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤任务分配列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F03.I01 | 数据录入页面 | 接口 | 样品检测数据录入 | 已上线 |
| M03.F03.I02 | 检测数据保存 | 接口 | 保存录入的检测数据 | 已上线 |
| M03.F03.I03 | 检测项编辑 | 接口 | 编辑已有检测数据 | 已上线 |
| M03.F03.I04 | 检测项删除 | 接口 | 删除检测项记录 | 已上线 |
| M03.F03.I05 | 自动评定 | 接口 | 系统按技术要求自动判定合格/不合格（TestRecord 精简后已移除自动评定，改为人工 verdict） | 已废弃 |
| M03.F03.I06 | 人工改判 | 接口 | 手工修正自动评定结果 | 已上线 |
| M03.F03.I07 | 数据录入三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤数据录入列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F05.I01 | 报告审核页面 | 接口 | 报告审核列表 | 已上线 |
| M03.F05.I02 | 报告查看 | 接口 | 查看报告详情 | 已上线 |
| M03.F05.I03 | 审核操作 | 接口 | 审核通过/驳回 | 已上线 |
| M03.F05.I04 | 报告审核三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤报告审核列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F06.I01 | 报告批准页面 | 接口 | 报告批准列表 | 已上线 |
| M03.F06.I02 | 报告查看 | 接口 | 查看报告详情 | 已上线 |
| M03.F06.I03 | 批准操作 | 接口 | 批准通过/驳回 | 已上线 |
| M03.F06.I04 | 报告批准三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤报告批准列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F07.I01 | 报告发放页面 | 接口 | 报告发放列表 | 已上线 |
| M03.F07.I02 | 报告查看 | 接口 | 查看报告详情 | 已上线 |
| M03.F07.I03 | 发放操作 | 接口 | 报告发放 | 已上线 |
| M03.F07.I04 | 报告发放三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤报告发放列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F08.I01 | 报告归档页面 | 接口 | 报告归档列表 | 已上线 |
| M03.F08.I02 | 报告查看 | 接口 | 查看报告详情 | 已上线 |
| M03.F08.I03 | 归档操作 | 接口 | 报告归档 | 已上线 |
| M03.F08.I04 | 报告归档三态过滤器 | 接口 | 全部/未提交/已提交：按 flowStatus 过滤报告归档列表 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M03.F09.I01 | 查看按钮 | 接口 | 各流程列表页 rowActions 加查看按钮，触发详情页 | 已上线 |
| M03.F09.I02 | 详情页 | 接口 | 展示接样信息、样品列表、检测数据；检测参数显示为「名称(单位)」、报告类别显示为报告简称 | 已上线 |
| M03.F09.I03 | 报告预览（详情页） | 接口 | 详情页标题栏按钮，复用 ReportPreviewModal，按 receipt.categoryCode 找模板 docx 渲染 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M04.F06.I01 | 型号列表 | 接口 | InspectionModel 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F06.I02 | 型号新建/编辑 | 接口 | 型号码表维护 | 已上线 |
| M04.F06.I03 | 型号删除 | 接口 | 删除保护：被技术要求引用时拒绝 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M04.F07.I01 | 规格列表 | 接口 | InspectionSpec 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F07.I02 | 规格新建/编辑 | 接口 | 规格码表维护 | 已上线 |
| M04.F07.I03 | 规格删除 | 接口 | 删除保护：被技术要求引用时拒绝 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M04.F08.I01 | 等级列表 | 接口 | InspectionGrade 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F08.I02 | 等级新建/编辑 | 接口 | 等级码表维护 | 已上线 |
| M04.F08.I03 | 等级删除 | 接口 | 删除保护：被技术要求引用时拒绝 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M04.F09.I01 | 牌号列表 | 接口 | InspectionBrand 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F09.I02 | 牌号新建/编辑 | 接口 | 牌号码表维护 | 已上线 |
| M04.F09.I03 | 牌号删除 | 接口 | 删除保护：被技术要求引用时拒绝 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M05.F01.I01 | 汇总表 | 接口 | 按报告名称（InspectionReportName）输出试验报告汇总表，报告名称下拉框选择汇总口径 | 已上线 |
| M05.F01.I02 | 汇总类型 | 接口 | 三种 summaryType（material/concrete/connection）列定义各异 | 已废弃 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F01.I01 | 检测专项列表 | 接口 | 按官方顺序展示专项、来源和启用状态 | 已上线 |
| M06.F01.I02 | 检测专项新建/编辑 | 接口 | 维护自定义专项和官方专项本地配置，官方来源字段只读 | 已上线 |
| M06.F01.I03 | 检测专项删除 | 接口 | 删除自定义且未被引用的专项，保护官方及已引用专项 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F02.I01 | 检测项目列表 | 接口 | 按专项展示项目、官方来源行、资质标记和准备状态 | 已上线 |
| M06.F02.I02 | 检测项目新建/编辑 | 接口 | 维护项目本地配置，官方来源字段只读 | 已上线 |
| M06.F02.I03 | 检测项目删除 | 接口 | 删除自定义且未被引用的项目，保护官方及已引用项目 | 规划 |
| M06.F02.I04 | 关联检测依据 | 接口 | 维护 role=TESTING 的项目检测依据标准 | 已上线 |
| M06.F02.I05 | 关联判定依据 | 接口 | 维护 role=JUDGMENT 的项目判定依据标准 | 已上线 |
| M06.F02.I06 | 关联检测参数 | 接口 | 维护项目参数多对多及资质必备/可选；prefilter 已上线（先选检测项目→过滤参数，UX 见 REQ-2026-011） | 已上线 |
| M06.F02.I07 | 关联检测专项 | 接口 | 维护 InspectionSpecialtyObject 多对多 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F03.I01 | 检测参数列表 | 接口 | 展示参数原名、规范名、方法、单位和来源 | 已上线 |
| M06.F03.I02 | 检测参数新建/编辑 | 接口 | 维护自定义参数和官方参数本地配置，官方来源字段只读 | 已上线 |
| M06.F03.I03 | 检测参数删除 | 接口 | 删除自定义且未被关联的参数，保护官方及已引用参数 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F04.I01 | 检测标准列表 | 接口 | 展示标准编号、名称、版本、来源和核验状态 | 已上线 |
| M06.F04.I02 | 检测标准新建/编辑 | 接口 | 维护标准元数据和本地配置，不覆盖来源原文 | 已上线 |
| M06.F04.I03 | 检测标准删除 | 接口 | 删除自定义且未被引用的标准，保护已引用标准 | 规划 |
| M06.F04.I04 | 关联检测参数 | 接口 | 维护标准参数多对多及条款、方法、单位、试验规则；prefilter 弹窗（先选检测项目→过滤参数）见 REQ-2026-011 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F05.I01 | 计算规则列表 | 接口 | 2 级树（检测项目→检测标准）+ 右侧列表（拖拽调整 sortOrder）；列：算法类型/试件数/备注 | 已上线 |
| M06.F05.I02 | 计算规则新建/编辑 | 接口 | 维护原始数据到检测结果的算法和适用条件 | 规划 |
| M06.F05.I03 | 计算规则删除 | 接口 | 删除未被检测数据引用的计算规则 | 规划 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F06.I01 | 技术要求列表 | 接口 | 2 级树（检测项目→检测标准）+ 右侧列表（拖拽调整 sortOrder）；列：判定模式/限值/备注 | 已上线 |
| M06.F06.I02 | 技术要求新建/编辑 | 接口 | 维护单项评定条件、限值、表达式、来源和判定模式 | 规划 |
| M06.F06.I03 | 技术要求删除 | 接口 | 删除未被检测结果引用的技术要求 | 规划 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F07.I01 | 报告名称列表 | 接口 | 展示 code/name/description/排序，按 sortOrder 排序，含关联项目/标准/参数计数 | 已上线 |
| M06.F07.I02 | 报告名称新建/编辑 | 接口 | 维护 code/name/sortOrder/description | 规划 |
| M06.F07.I03 | 报告名称删除 | 接口 | 删除保护：被关联项目/标准/参数引用时拒绝 | 规划 |
| M06.F07.I04 | 关联检测项目 | 接口 | 维护 InspectionObjectReportName 中间表 | 规划 |
| M06.F07.I05 | 关联检测依据 | 接口 | 维护 InspectionReportNameStandard role=TESTING | 规划 |
| M06.F07.I06 | 关联判定依据 | 接口 | 维护 InspectionReportNameStandard role=JUDGMENT | 规划 |
| M06.F07.I07 | 关联检测参数 | 接口 | 维护 InspectionReportNameParameter 中间表；prefilter 弹窗（先选检测项目→过滤参数）+ 参数清单行追加「· 对象名」，见 REQ-2026-012 | 规划 |
| M06.F07.I08 | 扩展属性维护 | 接口 | 维护 InspectionReportName.extFields 列表（key/label/type/required/tag/source/options）；预览前若样品 ext 未覆盖对应 key，会自动弹 SampleExtFieldsModal（M03.F01.I07）让用户补录 | 已上线 |


| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M06.F08.I01 | 参数界面列表 | 接口 | 展示 code/name/componentPath/关联参数，按 sortOrder 排序 | 规划 |
| M06.F08.I02 | 参数界面新建/编辑 | 接口 | 维护 code/name/componentPath(模型 key)/config(JSON)/sortOrder/description | 规划 |
| M06.F08.I03 | 参数界面删除 | 接口 | 删除保护：isOfficial 内置模型（17 个：default / concrete-compress / concrete-permeability / cement-flexural / cement-compress / rebar-welding-tensile / rebar-welding-bend / rebar-mech-tensile / rebar-mech-yield / rebar-mech-elongation / particle-gradation / rebar-mech-yield-ratio / rebar-mech-connection-tensile / mortar-compress / soil-compaction / soil-compaction-degree-sand / soil-compaction-degree-ring）拒绝 | 规划 |
| M06.F08.I04 | 关联检测参数 | 接口 | 维护 InspectionParameterParamInterface 中间表（参数↔界面 M:N，支持 reportNameCode 报告作用域） | 已上线 |
| M06.F08.I05 | 参数界面预览 | 接口 | 列表行按钮：按绑定 componentPath 渲染该录入卡只读预览（mock 单样品 + 示例技术要求） | 规划 |
| M06.F08.I06 | 参数界面预览弹窗 | 接口 | 模态：渲染注册的参数录入卡组件只读模式，供配置时查看录入卡样式 | 规划 |

---

## 维护约定

- 谁改功能，谁改表，同一个 commit。
- `规划` → `开发中`：必须先有需求文档引用它。
- `开发中` → `已上线`：L5 会警告它缺设计映射与测试引用。警告不阻断，由人裁量。
- infra 模块的特殊性：M97 全规划，**没有 UI/data-fn**，所以 fnTest 列故意留空，trace.json 留 `[]`。
- nextjs-as-backend：M98.F03 的 5 个 API route 是「家族定位要求」的功能，不是产品代码。
- BASE F 级下的 I 级子项镜像自 REF（backup/lab-management-system），只收父 F ∈ BASE 的行；BASE 外的 15 个 F 级段（老机构/角色/用户管理、人员/设备/设施、报告编制、旧报告类别/模板/标准/参数/技术要求、合同类别/计算规则/试件尺寸）不入本仓树，由 check_align 裁决锁定。
