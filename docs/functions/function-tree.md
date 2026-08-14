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
M00..M06 是 shared BASE 镜像，本仓仅消费 openapi.yaml 的契约 + 演示 BackendSwitcher + LoginForm；其下 F 级保持"接口"类型，本仓无业务页面。

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

## BASE F 级（M0x.F0y，shared BASE 镜像，本仓仅消费）

| 功能 ID | 功能 | 闭环定义 | 类型 | 状态 |
|---|---|---|---|---|
| M00.F01 | 当前用户会话 | 当前用户信息 + 关联租户列表 + 当前选中租户（GET /auth/me） | 查询 | 规划 |
| M00.F02 | 登录选租户 | 登录后选择租户，换发携带 tenant_id claim 的 token（POST /auth/switch-tenant） | 接口 | 规划 |
| M01.F04 | 权限管理 | RBAC 角色权限、路由守卫、权限指令、动态菜单（身份平台下发） | 接口 | 规划 |
| M01.F05 | 认证管理 | 用户名+密码登录 + SSO 统一登录（对接身份平台），JWT 签发与校验 | 接口 | 规划 |
| M02.F01 | 合同管理 | 合同 CRUD、工程信息维护 | 接口 | 规划 |
| M03.F01 | 接样管理 | 接样单 CRUD、报告类别关联、流程状态 | 接口 | 规划 |
| M03.F02 | 任务分配 | 接样提交后安排检测人员/计划日期，提交进入数据录入；任务字段挂 SampleReceipt | 接口 | 规划 |
| M03.F03 | 数据录入 | 样品检测数据录入 | 接口 | 规划 |
| M03.F05 | 报告审核 | 报告审核流程 | 接口 | 规划 |
| M03.F06 | 报告批准 | 报告批准流程 | 接口 | 规划 |
| M03.F07 | 报告发放 | 报告发放流程 | 接口 | 规划 |
| M03.F08 | 报告归档 | 报告归档流程 | 接口 | 规划 |
| M03.F09 | 接样单详情 | 接样单查看（接样信息+样品信息+检测数据） | 接口 | 规划 |
| M04.F06 | 型号维护 | InspectionModel 实体码表维护，列表按检测专项过滤 | 接口 | 规划 |
| M04.F07 | 规格维护 | InspectionSpec 实体码表维护，列表按检测专项过滤 | 接口 | 规划 |
| M04.F08 | 等级维护 | InspectionGrade 实体码表维护，列表按检测专项过滤 | 接口 | 规划 |
| M04.F09 | 牌号维护 | InspectionBrand 实体码表维护，列表按检测专项过滤 | 接口 | 规划 |
| M05.F01 | 报告汇总 | 按报告类别输出试验报告汇总表 | 查询 | 规划 |
| M06.F01 | 检测专项 | InspectionSpecialty CRUD（检测能力字典根） | 接口 | 规划 |
| M06.F02 | 检测项目 | InspectionObject CRUD + 专项/参数关联 | 接口 | 规划 |
| M06.F03 | 检测参数 | InspectionParameter CRUD + 标准/参数关联 | 接口 | 规划 |
| M06.F04 | 检测标准 | InspectionStandard CRUD（含状态：active/superseded/draft） | 接口 | 规划 |
| M06.F05 | 计算规则 | CalculationRule 维护（复合主键，算法类型 + 公式） | 接口 | 规划 |
| M06.F06 | 技术要求 | TechnicalRequirement 维护，按四维度匹配；brand/model/grade/spec 改为 FK 引用实体 | 接口 | 规划 |
| M06.F07 | 报告名称 | InspectionReportName CRUD + extFields 模板 + 关联标准/参数 | 接口 | 规划 |
| M06.F08 | 参数界面 | ParamInterface 维护 + 参数↔界面 link | 接口 | 规划 |

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
| M98.F01 | 运行时后端切换（4-backend） | msw / aspnetcore / springboot / nextjs 选择，baseURL 持久化到 localStorage | 规划 |
| M98.F02 | http-client 注入 | axios 拦截器在 baseURL = getBaseUrl() 上自动跑 | 规划 |
| M98.F03 | Next.js API routes（自身作后端） | `/api/auth/{login,me,logout,refresh,switch-tenant}` 5 个路由；nextjs-backend-mode 下命中 | 规划 |

### M98.F01 运行时后端切换

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F01.I01 | BackendSwitcher 下拉 | 按钮 | 4-backend 下拉；data-fn=`M98.F01.I01` 锚点在 src/components/app/backend-switcher.tsx | 规划 |
| M98.F01.I02 | 持久化 baseUrl | 接口 | localStorage[`lab.backend`]；跨标签 storage 事件同步 | 规划 |

### M98.F02 http-client 注入

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F02.I01 | axios 拦截器 | 接口 | src/api/http-client.ts 的 installHttpClient；注入 baseURL + Authorization | 规划 |

### M98.F03 Next.js API routes

| 子项 ID | 名称 | 类型 | 说明 | 状态 |
|---|---|---|---|---|
| M98.F03.I01 | POST /api/auth/login | 接口 | demo：返 mock token + 3 租户；真路径接 pg | 规划 |
| M98.F03.I02 | GET /api/auth/me | 接口 | 当面用户 + tenants[] + currentTenantId | 规划 |
| M98.F03.I03 | POST /api/auth/logout | 接口 | 204 No Content | 规划 |
| M98.F03.I04 | POST /api/auth/refresh | 接口 | 用 refreshToken 换新 token | 规划 |
| M98.F03.I05 | POST /api/auth/switch-tenant | 接口 | 校验 tenantId 后换 token；msw 仓的同款语义 | 规划 |

---

## 维护约定

- 谁改功能，谁改表，同一个 commit。
- `规划` → `开发中`：必须先有需求文档引用它。
- `开发中` → `已上线`：L5 会警告它缺设计映射与测试引用。警告不阻断，由人裁量。
- infra 模块的特殊性：M97 全规划，**没有 UI/data-fn**，所以 fnTest 列故意留空，trace.json 留 `[]`。
- nextjs-as-backend：M98.F03 的 5 个 API route 是「家族定位要求」的功能，不是产品代码。
- BASE F 级（M00..M06）不允许本仓加 I 级子项，因为本仓不实现产品页面；后续按需求走 /tree-change 把额外 I 级加到 react/vue。
