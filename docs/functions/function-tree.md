# 功能清单（Function Tree）— lab-management-system-nextjs

> **全体系唯一锚点。** 需求、流程、设计、测试都引用这里的 ID。
> 不在这里的 ID 是悬空引用，L5 门会拦。**改功能，先改这份表。**

## 编号规则

| 层级 | 名称 | 格式 | 含义 |
|---|---|---|---|
| 一级 | 功能模块 | `M01` | 业务域边界，通常对应一级菜单 |
| 二级 | 功能 | `M01.F01` | 一个完整业务步骤 / 独立闭环流程 / 数据管理页面 |
| 三级 | 功能子项 | `M01.F01.I01` | 最小操作单元。标签页、查询条件、增删改查/审核/导入导出按钮 |

**硬规则**

1. 编号单调递增，永不复用。废弃改状态，不删行。
2. 子项编号必须以父级为前缀。
3. 一个子项 = 一个权限点。权限码即 ID，不另起一套编码。
4. 拆不出子项的功能 → 它其实是子项，往上并。子项超 20 个 → 它其实是模块，往下拆。

**状态**：`规划` | `开发中` | `已上线` | `已废弃`
**子项类型**：`页面` | `标签页` | `查询` | `按钮` | `报表` | `接口`

## 本仓角色

**infra-only**（schema emit + pg runtime lend）。本模块（M97）下**全为「接口」类型**——没有 UI、没有产品路由。

---

## 模块总览

| 模块 ID | 模块名称 | 业务域边界 | 状态 |
|---|---|---|---|
| M97 | schema emit infrastructure | lab-management-system-shared V*.sql → {schema.sql, schema.dbml, schema.ts} + pg 借链 | 规划 |
| M98 | frontend 接线层 | 4-backend 切换 + apiclient + Next.js API routes（自身作后端） | 规划 |

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
