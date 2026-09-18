# 功能清单（Function Tree）— lab-management-system-nextjs

> **全体系唯一锚点。** 需求、流程、设计、测试都引用这里的 ID。
> 不在这里的 ID 是悬空引用，L5 门会拦。**改功能，先改这份表。**

## 编号规则

| 层级 | 名称 | 格式 | 含义 |
|---|---|---|---|
| 一级 | 功能模块 | `M0x` | 业务域边界，通常对应一级菜单（实际命名见各仓模块总览） |
| 二级 | 功能 | `M0x.F0y` | 一个完整业务步骤 / 独立闭环流程 / 数据管理页面 |
| 三级 | 功能子项 | `M0x.F0y.I0z` | 技术交付单元 / 权限挂载点。对应一个 API 接口、页面组件、图表区块或权限控制点 |

**硬规则**

1. 编号单调递增，永不复用。废弃改状态，不删行。
2. 子项编号必须以父级为前缀。
3. 一个子项 = 一个权限点。权限码即 ID，不另起一套编码。
4. 拆不出子项的功能 → 它其实是子项，往上并。子项超 20 个 → 它其实是模块，往下拆。

**状态**：`规划` | `开发中` | `已上线` | `已废弃`
**子项类型**：`页面` | `标签页` | `查询` | `按钮` | `报表` | `接口`

## 本仓角色

**Full-stack 前端 + schema emit infra 仓**。Next.js 特殊：既是前端，又可通过 API routes 作后端。
M00..M06 是 shared BASE 镜像（full-feature-parity Task 6）：26 个 BASE F 级原样 + REF 树中挂在这些 F 级下的 I 级子项（父 F ∈ BASE，check_align 合法扩充）。REF 已上线/开发中行在本仓初始「规划」，落地后逐波 tree-change 推进；REF 已废弃行照抄「已废弃」。

---

## 模块总览

| 模块 ID | 模块名称 | 说明 | 状态 |
|---|---|---|---|
| M00 | 租户管理 | 当前用户关联租户列表、登录选租户、切换租户 | 规划 |
| M01 | 认证管理 | 权限管理（RBAC/路由守卫/动态菜单）、认证（登录/SSO/JWT） | 规划 |
| M02 | 资源管理 | 合同管理 | 规划 |
| M03 | 试验过程管理 | 接样 → 任务分配 → 数据录入 → 报告审核 → 批准 → 发放 → 归档 | 规划 |
| M04 | 基础数据 | 型号/规格/等级/牌号维护 | 规划 |
| M05 | 数据统计 | 报告汇总表（按报告名称） | 规划 |
| M06 | 检测能力 | 检测专项/项目/参数/标准/计算方法/技术要求/报告名称/参数界面 | 规划 |

---

## M00 租户管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M00.F01 | 当前用户会话 | 当前用户信息 + 关联租户列表 + 当前选中租户（GET /auth/me） | 规划 |
| M00.F02 | 登录选租户 | 登录后选择租户，换发携带 tenant_id claim 的 token（POST /auth/switch-tenant） | 规划 |

### M00.F01 当前用户会话

| 功能 ID | 子项名称 | 类型 | 端 | 说明 | 状态 |
|---|---|---|---|---|---|
| M00.F01.I01 | 会话信息展示 | 接口 | 前端+后端 | GET /auth/me hydrate user/tenants/currentTenantId；顶栏登出旁显示登录用户 displayName（data-testid=user-display-name） | 已上线 |

### M00.F02 登录选租户

| 功能 ID | 子项名称 | 类型 | 端 | 说明 | 状态 |
|---|---|---|---|---|---|
| M00.F02.I01 | 租户切换组件 | 按钮 | 前端+后端 | 顶栏 TenantSwitcher（DropdownMenu + Building2，对齐 saas 视觉）：列出当前用户租户，选中调 POST /auth/switch-tenant 换发真 HS256 token，会话不断（data-fn=M00.F02.I01） | 已上线 |

---

## M01 认证管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M01.F04 | 权限管理 | RBAC 角色权限、路由守卫、权限指令、动态菜单（身份平台下发） | 规划 |
| M01.F05 | 认证管理 | 用户名+密码登录 + SSO 统一登录（对接身份平台），JWT 签发与校验 | 规划 |

### M01.F04 权限管理

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M01.F04.I01 | 动态菜单下发（GET /auth/menus） | 查询 | 前端+后端 |  | 已上线 |
| M01.F04.I02 | 路由守卫 | 接口 | 前端+后端 | 未登录跳转登录页；角色不匹配跳转 403；三态正确拦截 | 已上线 |
| M01.F04.I03 | 路由守卫（未登录/无权限拦截） | 接口 | 前端+后端 | 前端路由守卫 useRequireAuth 钩子（react/vue 仓实现）；本仓 BASE 登记仓内未挂 entry，react/vue 仓 useRequireAuth 5+ 处引用作为产品线 anchor | 已上线 |
| M01.F04.I04 | 动态菜单（lab 侧边栏） | 接口 | 前端+后端 | 侧边栏容器锚点（nextjs 仓 `<aside>` 实现）；与 I01 共端点 /api/auth/menus（lab 本地端点，非 saas IdP /menus?appId=lab-management） | 已上线 |

### M01.F05 认证管理

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M01.F05.I01 | JWT 登录 | 接口 | 前端+后端 | 用户名+密码登录，MSW mock 层签发 JWT token | 已废弃 |
| M01.F05.I02 | Token 校验 | 接口 | 前端+后端 | 请求拦截器注入 Bearer token，token 失效跳转登录 | 已上线 |
| M01.F05.I03 | SSO OAuth 2.0 授权码流（client_secret 后端持 + state CSRF 防护） | 接口 | 前端+后端 | 授权码流：authorize 收 response_type=code&client_id=lab&redirect_uri=<callback>&state=<random>（sessionStorage「lab.sso.state」）→ callback body {grant_type:authorization_code, code, redirect_uri}；saas token 不出 lab 后端 | 已上线 |
| M01.F05.I04 | 身份会话同步 | 接口 | 前端+后端 | 用身份平台 token+user 建会话，并从 /auth/permissions 拉取权限集（机构=租户 1:1） | 已上线 |
| M01.F05.I05 | 登出 | 接口 | 前端+后端 | Layout 侧边栏底部展示当前用户 + 退出按钮：点击调 authStore.logout() 清 token/user 并跳 /login | 已上线 |

---

## M02 资源管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M02.F01 | 合同管理 | 合同 CRUD、工程信息维护 | 已上线 |

### M02.F01 合同管理

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M02.F01.I01 | 合同列表 | 接口 | 前端+后端 | 合同 CRUD | 已上线 |
| M02.F01.I02 | 合同详情 | 接口 | 前端+后端 | BASE 编号对齐：GET /api/contracts/{id}；原「合同新建/编辑」语义迁至 I06/I07（2026-09-18 批次 2） | 已上线 |
| M02.F01.I03 | 合同删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M02.F01.I05（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M02.F01.I04 | 合同汇总 | 接口 | 前端+后端 | 按合同统计汇总数据 | 已废弃 |
| M02.F01.I05 | 删除合同 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/contracts/{id}：204；被接样引用 FK RESTRICT 拒（实现即原 M02.F01.I03） | 已上线 |
| M02.F01.I06 | 创建合同 | 接口 | 前端+后端 | BASE I03 编号被废弃行占用顺延 I06；POST /api/contracts：code/clientUnit/projectName/constructionUnit/witnessUnit/witness 必填 | 已上线 |
| M02.F01.I07 | 更新合同 | 接口 | 前端+后端 | BASE I04 顺延 I07；PUT /api/contracts/{id} PATCH 语义；随 BASE 状态 开发中 | 开发中 |

---

## M03 试验过程管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M03.F01 | 接样管理 | 接样单 CRUD、报告类别关联、流程状态 | 已上线 |
| M03.F02 | 任务分配 | 接样提交后安排检测人员/计划日期，提交进入数据录入；任务字段挂 SampleReceipt | 已上线 |
| M03.F03 | 数据录入 | 样品检测数据录入 | 已上线 |
| M03.F05 | 报告审核 | 报告审核流程 | 已上线 |
| M03.F06 | 报告批准 | 报告批准流程 | 已上线 |
| M03.F07 | 报告发放 | 报告发放流程 | 已上线 |
| M03.F08 | 报告归档 | 报告归档流程 | 已上线 |
| M03.F09 | 接样单详情 | 接样单查看（接样信息+样品信息+检测数据） | 已上线 |

### M03.F01 接样管理

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F01.I01 | 接样单列表 | 接口 | 前端+后端 | 创建/查看/编辑/删除接样单，含 categoryCode | 已上线 |
| M03.F01.I02 | 接样单新建 | 接口 | 前端+后端 | 含 receiptCode/contractId/categoryCode | 已上线 |
| M03.F01.I03 | 接样单编辑 | 接口 | 前端+后端 | 接样单信息修改 | 已上线 |
| M03.F01.I04 | 接样单删除 | 接口 | 前端+后端 | 接样单删除 | 已上线 |
| M03.F01.I05 | 接样单详情 | 接口 | 前端+后端 | 含 flowStatus（待提交/审核中/已批准/已发放/已归档）+ flowHistory | 已废弃 |
| M03.F01.I06 | 接样单三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤接样单列表 | 已上线 |
| M03.F01.I07 | 接样单 ext 字段补录 | 接口 | 前端+后端 | 报告预览前按当前类别 extFields 弹 SampleExtFieldsModal，补录持久化到 Sample.ext | 已上线 |
| M03.F01.I08 | 接样-提交 | 接口 | 前端+后端 | POST /api/receipts/receiving/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I09 退回/I10 撤回语义并入本行；7 阶段全 act 模式） | 已上线 |
| M03.F01.I09 | 接样-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F01.I08（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F01.I10 | 接样-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F01.I08（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F02 任务分配

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F02.I01 | 任务分配 | 接口 | 前端+后端 | 接样提交后进入分配中，安排检测人员+计划日期 | 已上线 |
| M03.F02.I02 | 任务编辑（客户端视角 anchor） | 接口 | 前端+后端 | 安排弹窗维护 assigneeName/assigneeId/plannedTestDate（**与 I01 共端点 PUT /api/receipts/{id}/task；保留 ID 作为客户端视角 anchor**，react/vue/nextjs 三仓 data-fn 同步从 I02 → I01） | 已上线 |
| M03.F02.I03 | 任务取消（清空分配） | 接口 | 前端+后端 | 清空 assignee/assigneeId/plannedTestDate，把已分配单子在本阶段重置为未分配（非退回接样；退回接样走 FlowStagePage 通用退回按钮） | 已上线 |
| M03.F02.I04 | 任务分配三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤任务分配列表 | 已上线 |
| M03.F02.I05 | 任务分配-提交 | 接口 | 前端+后端 | POST /api/receipts/assigning/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I06 退回/I07 撤回语义并入本行；7 阶段全 act 模式） | 已上线 |
| M03.F02.I06 | 任务分配-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F02.I05（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F02.I07 | 任务分配-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F02.I05（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F03 数据录入

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F03.I01 | 样品列表 | 接口 | 前端+后端 | BASE I01 对齐：GET /api/samples?receiptId=&keyword=；原「数据录入页面」语义由页面 data-fn 锚点并入本行与 I06 | 已上线 |
| M03.F03.I02 | 样品详情 | 接口 | 前端+后端 | BASE I02 对齐：GET /api/samples/{id}；原「检测数据保存」语义并入 I08/I09 | 已上线 |
| M03.F03.I03 | 创建样品 | 接口 | 前端+后端 | BASE I03 对齐：POST /api/samples：receipt_id FK 必存在；ext 默认 {}；原「检测项编辑」语义并入 I09 | 已上线 |
| M03.F03.I04 | 检测项删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M03.F03.I10（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M03.F03.I05 | 自动评定 | 接口 | 前端+后端 | 系统按技术要求自动判定合格/不合格（TestRecord 精简后已移除自动评定，改为人工 verdict） | 已废弃 |
| M03.F03.I06 | 人工改判 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M03.F03.I11（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M03.F03.I07 | 数据录入三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤数据录入列表 | 已上线 |
| M03.F03.I08 | 检测记录列表 API | 接口 | 前端+后端 | GET /api/test-records?sampleId=&receiptId=&page=&pageSize=（receiptId 经 receipt→samples 归集）；springboot 对称端点为其 I06，本仓 I06 已被人工改判占用故顺延 | 已上线 |
| M03.F03.I09 | 创建检测记录 API | 接口 | 前端+后端 | POST /api/test-records → 201；springboot 对称端点为其 I08，本仓顺延 | 已上线 |
| M03.F03.I10 | 删除检测记录 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/test-records/{id}：204 if exists（实现即原 M03.F03.I04） | 已上线 |
| M03.F03.I11 | 检测记录改判 | 接口 | 前端+后端 | BASE 编号对齐：PUT /api/test-records/{id}/verdict：人工改判（实现即原 M03.F03.I06） | 已上线 |
| M03.F03.I12 | 数据录入-提交 | 接口 | 前端+后端 | POST /api/receipts/data-entry/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I13 退回/I14 撤回语义并入本行；7 阶段全 act 模式） | 已上线 |
| M03.F03.I13 | 数据录入-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F03.I12（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F03.I14 | 数据录入-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F03.I12（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |
| M03.F03.I15 | 数据录入三态过滤器 | 按钮 | 仅前端 | 全部/未提交/已提交：按 flowStatus 过滤数据录入列表（前端过滤器，触发 GET /api/receipts?flowStatus=…） | 开发中 |
| M03.F03.I16 | 更新样品 | 接口 | 前端+后端 | BASE I04 编号被废弃行（原检测项删除→I10）占用顺延 I16；PUT /api/samples/{id} PATCH 语义 | 规划 |
| M03.F03.I17 | 删除样品 | 接口 | 前端+后端 | BASE I05 同上顺延 I17；DELETE /api/samples/{id}：204 | 规划 |

### M03.F05 报告审核

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F05.I01 | 报告审核页面 | 接口 | 前端+后端 | 报告审核列表 | 已上线 |
| M03.F05.I02 | 报告查看 | 接口 | 前端+后端 | 查看报告详情 | 已上线 |
| M03.F05.I03 | 审核操作 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：双胞收敛（同 react/vue 批次 1），端点锚定收敛至 M03.F05.I07（act 共端点），本行无独立端点 | 已废弃 |
| M03.F05.I04 | 报告审核三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤报告审核列表 | 已上线 |
| M03.F05.I05 | 报告审核-批量提交（已废） | 接口 | 前端+后端 | POST /api/receipts/review/batch-submit：2026-09-17 标记 已废弃，删 op（未实现） | 已废弃 |
| M03.F05.I06 | 报告审核-批量退回（已废） | 接口 | 前端+后端 | POST /api/receipts/review/batch-return：2026-09-17 标记 已废弃，删 op（未实现） | 已废弃 |
| M03.F05.I07 | 报告审核-提交 | 接口 | 前端+后端 | POST /api/receipts/review/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I08 退回/I09 撤回语义并入本行；4 阶段全 act 合并方案 B） | 已上线 |
| M03.F05.I08 | 报告审核-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F05.I07（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F05.I09 | 报告审核-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F05.I07（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F06 报告批准

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F06.I01 | 报告批准页面 | 接口 | 前端+后端 | 报告批准列表 | 已上线 |
| M03.F06.I02 | 报告查看 | 接口 | 前端+后端 | 查看报告详情 | 已上线 |
| M03.F06.I03 | 批准操作 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：双胞收敛（同 react/vue 批次 1），端点锚定收敛至 M03.F06.I05（act 共端点），本行无独立端点 | 已废弃 |
| M03.F06.I04 | 报告批准三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤报告批准列表 | 已上线 |
| M03.F06.I05 | 报告批准-提交 | 接口 | 前端+后端 | POST /api/receipts/approve/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I06 退回/I07 撤回语义并入本行；4 阶段全 act 合并方案 B） | 已上线 |
| M03.F06.I06 | 报告批准-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F06.I05（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F06.I07 | 报告批准-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F06.I05（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F07 报告发放

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F07.I01 | 报告发放页面 | 接口 | 前端+后端 | 报告发放列表 | 已上线 |
| M03.F07.I02 | 报告查看 | 接口 | 前端+后端 | 查看报告详情 | 已上线 |
| M03.F07.I03 | 发放操作 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：双胞收敛（同 react/vue 批次 1），端点锚定收敛至 M03.F07.I05（act 共端点），本行无独立端点 | 已废弃 |
| M03.F07.I04 | 报告发放三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤报告发放列表 | 已上线 |
| M03.F07.I05 | 报告发放-提交 | 接口 | 前端+后端 | POST /api/receipts/issuance/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I06 退回/I07 撤回语义并入本行；4 阶段全 act 合并方案 B） | 已上线 |
| M03.F07.I06 | 报告发放-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F07.I05（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F07.I07 | 报告发放-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F07.I05（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F08 报告归档

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F08.I01 | 报告归档页面 | 接口 | 前端+后端 | 报告归档列表 | 已上线 |
| M03.F08.I02 | 报告查看 | 接口 | 前端+后端 | 查看报告详情 | 已上线 |
| M03.F08.I03 | 归档操作 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：双胞收敛（同 react/vue 批次 1），端点锚定收敛至 M03.F08.I05（act 共端点），本行无独立端点 | 已废弃 |
| M03.F08.I04 | 报告归档三态过滤器 | 接口 | 前端+后端 | 全部/未提交/已提交：按 flowStatus 过滤报告归档列表 | 已上线 |
| M03.F08.I05 | 报告归档-提交 | 接口 | 前端+后端 | POST /api/receipts/archived/act，body.action={SUBMIT、RETURN、WITHDRAW} 三动作统一（2026-09-18：I06 退回/I07 撤回语义并入本行；4 阶段全 act 合并方案 B） | 已上线 |
| M03.F08.I06 | 报告归档-退回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F08.I05（act 端点以 body.action=RETURN 区分，无独立端点） | 已废弃 |
| M03.F08.I07 | 报告归档-撤回 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：语义并入 M03.F08.I05（act 端点以 body.action=WITHDRAW 区分，无独立端点） | 已废弃 |

### M03.F09 接样单详情

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M03.F09.I01 | 查看按钮 | 接口 | 前端+后端 | 各流程列表页 rowActions 加查看按钮，触发详情页 | 已上线 |
| M03.F09.I02 | 详情页 | 接口 | 前端+后端 | 展示接样信息、样品列表、检测数据；检测参数显示为「名称(单位)」、报告类别显示为报告简称 | 已上线 |
| M03.F09.I03 | 报告预览（详情页） | 接口 | 仅前端 | 详情页标题栏按钮，复用 ReportPreviewModal，按 receipt.categoryCode 找模板 docx 渲染 | 已上线 |

---

## M04 基础数据

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M04.F06 | 型号维护 | InspectionModel 实体码表维护，列表按检测专项过滤 | 已上线 |
| M04.F07 | 规格维护 | InspectionSpec 实体码表维护，列表按检测专项过滤 | 已上线 |
| M04.F08 | 等级维护 | InspectionGrade 实体码表维护，列表按检测专项过滤 | 已上线 |
| M04.F09 | 牌号维护 | InspectionBrand 实体码表维护，列表按检测专项过滤 | 已上线 |

### M04.F06 型号维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F06.I01 | 型号列表 | 接口 | 前端+后端 | InspectionModel 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F06.I02 | 型号新建/编辑 | 接口 | 前端+后端 | 型号码表维护 | 已上线 |
| M04.F06.I03 | 型号删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M04.F06.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M04.F06.I04 | 删除型号 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/catalog/models/{code}：204；被技术要求引用时拒（实现即原 M04.F06.I03） | 已上线 |

### M04.F07 规格维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F07.I01 | 规格列表 | 接口 | 前端+后端 | InspectionSpec 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F07.I02 | 规格新建/编辑 | 接口 | 前端+后端 | 规格码表维护 | 已上线 |
| M04.F07.I03 | 规格删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M04.F07.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M04.F07.I04 | 删除规格 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/catalog/specs/{code}：204（实现即原 M04.F07.I03） | 已上线 |

### M04.F08 等级维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F08.I01 | 等级列表 | 接口 | 前端+后端 | InspectionGrade 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F08.I02 | 等级新建/编辑 | 接口 | 前端+后端 | 等级码表维护 | 已上线 |
| M04.F08.I03 | 等级删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M04.F08.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M04.F08.I04 | 删除等级 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/catalog/grades/{code}：204（实现即原 M04.F08.I03） | 已上线 |

### M04.F09 牌号维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F09.I01 | 牌号列表 | 接口 | 前端+后端 | InspectionBrand 实体码表，左侧检测项目树 + 右侧列表（拖拽调整 sortOrder 持久化） | 已上线 |
| M04.F09.I02 | 牌号新建/编辑 | 接口 | 前端+后端 | 牌号码表维护 | 已上线 |
| M04.F09.I03 | 牌号删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M04.F09.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M04.F09.I04 | 删除牌号 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/catalog/brands/{code}：204（实现即原 M04.F09.I03） | 已上线 |

---

## M05 数据统计

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M05.F01 | 报告汇总 | 按报告名称输出试验报告汇总表 | 已上线 |

### M05.F01 报告汇总

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M05.F01.I01 | 汇总表 | 接口 | 前端+后端 | 按报告名称（InspectionReportName）输出试验报告汇总表，报告名称下拉框选择汇总口径 | 已上线 |
| M05.F01.I02 | 仪表盘容器 | 页面 | 仅前端 | SummaryPage 最外层 layout 锚点，包裹 I03/I04/I05 三区块 | 已上线 |
| M05.F01.I03 | 核心指标卡 | 查询 | 前端+后端 | 今日试验总数 + 检测合格率（按材料类型 concrete/rebar/sand）+ 报告产出量（已生成/已签发/待审核）；GET /api/summary/stats 扩展 todayTestCount/qualifiedRateByMaterial/reportOutputByStatus | 已上线 |
| M05.F01.I04 | 任务状态漏斗 | 报表 | 前端+后端 | 6 段实时计数：待取样→已收样→试验中→报告编制→待审核→已签发；GET /api/summary/stats 扩展 funnelByStage:{pending_collect, received, testing, reporting, reviewing, issued} | 已上线 |
| M05.F01.I05 | 见证取样跟踪 | 报表 | 前端+后端 | 见证率（合同需见证的接样单中已完成见证的比例）+ 见证到位情况明细；GET /api/summary/stats 扩展 witnessStats:{requireWitness, witnessed, witnessRate, details[]} | 规划 |
| M05.F01.I06 | 仪表盘统计基础端点 | 查询 | 前端+后端 | GET /api/summary/stats 基础字段：contractCount/receiptCount/sampleCount + 报告状态 3 桶（draft=receiving+task+data_entry；reviewing=review+approval；issued=issuance+archived）+ pendingTaskCount。ADR-0033 阶段二自 M05.F02.I01 改挂 F01（BASE I06 下沉对齐） | 已上线 |

---

## M06 检测能力

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M06.F01 | 检测专项 | InspectionSpecialty CRUD（检测能力字典根） | 已上线 |
| M06.F02 | 检测项目 | InspectionObject CRUD + 专项/参数关联 | 已上线 |
| M06.F03 | 检测参数 | InspectionParameter CRUD + 标准/参数关联 | 已上线 |
| M06.F04 | 检测标准 | InspectionStandard CRUD（含状态：active/superseded/draft） | 已上线 |
| M06.F05 | 计算方法 | CalculationRule 维护（复合主键，算法类型 + 公式） | 已上线 |
| M06.F06 | 技术要求 | TechnicalRequirement 维护，按四维度匹配；brand/model/grade/spec 改为 FK 引用实体 | 已上线 |
| M06.F07 | 报告名称 | InspectionReportName CRUD + extFields 模板 + 关联标准/参数 | 已上线 |
| M06.F08 | 参数界面 | ParamInterface 维护 + 参数↔界面 link | 已上线 |

### M06.F01 检测专项

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F01.I01 | 检测专项列表 | 接口 | 前端+后端 | 按官方顺序展示专项、来源和启用状态 | 已上线 |
| M06.F01.I02 | 检测专项新建/编辑 | 接口 | 前端+后端 | 维护自定义专项和官方专项本地配置，官方来源字段只读 | 已上线 |
| M06.F01.I03 | 检测专项删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F01.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F01.I04 | 删除专项 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/inspection/specialties/{code}：保护官方及已引用专项（实现即原 M06.F01.I03） | 已上线 |
| M06.F01.I05 | 项目↔标准 link | 接口 | 前端+后端 | BASE 编号对齐：POST /api/inspection/links/object-standard：role 必填 TESTING/JUDGMENT；吸收原 M06.F02.I04（检测依据）+ M06.F02.I05（判定依据）双行语义 | 已上线 |
| M06.F01.I06 | 项目↔标准 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/inspection/links/object-standard：404 if 不存在 | 已上线 |
| M06.F01.I07 | 项目↔标准 列表 | 接口 | 前端+后端 | BASE 编号对齐：GET /api/links/object-standard?inspectionObjectCode=&role=：按 objectCode/role 过滤 | 已上线 |

### M06.F02 检测项目

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F02.I01 | 检测项目列表 | 接口 | 前端+后端 | 按专项展示项目、官方来源行、资质标记和准备状态 | 已上线 |
| M06.F02.I02 | 检测项目新建/编辑 | 接口 | 前端+后端 | 维护项目本地配置，官方来源字段只读 | 已上线 |
| M06.F02.I03 | 检测项目删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I03=更新项目）；删除语义迁至 I11，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F02.I04 | 关联检测依据 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F01.I05（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F02.I05 | 关联判定依据 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F01.I05（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F02.I06 | 关联检测参数 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I06=专项↔项目 unlink）；项目↔参数 link 语义迁至 I14，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F02.I07 | 关联检测专项 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I05=专项↔项目 link）；语义迁至 I13，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F02.I08 | 项目↔参数 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/inspection/links/object-parameter：404 if 不存在 | 已上线 |
| M06.F02.I09 | 专项↔项目 列表 | 接口 | 前端+后端 | BASE 编号对齐：GET /api/inspection/links/specialty-object?inspectionSpecialtyCode=：按专项 code 过滤 | 已上线 |
| M06.F02.I10 | 项目↔参数 列表 | 接口 | 前端+后端 | BASE 编号对齐：GET /api/inspection/links/object-parameter?inspectionObjectCode=&inspectionParameterCode=：按 objectCode/parameterCode 过滤 | 已上线 |
| M06.F02.I11 | 删除项目 | 接口 | 前端+后端 | BASE I04 编号被废弃行占用顺延 I11；DELETE /api/inspection/objects/{code}：204 if exists | 规划 |
| M06.F02.I12 | 更新项目 | 接口 | 前端+后端 | BASE I03 语义顺延补齐 I12；PUT /api/inspection/objects/{code} PATCH 语义 | 规划 |
| M06.F02.I13 | 专项↔项目 link | 接口 | 前端+后端 | BASE I05 顺延 I13；POST /api/inspection/links/specialty-object（实现即原 I07） | 已上线 |
| M06.F02.I14 | 项目↔参数 link | 接口 | 前端+后端 | BASE I07 顺延 I14；POST /api/inspection/links/object-parameter（实现即原 I06，含资质必备/可选 + prefilter） | 已上线 |
| M06.F02.I15 | 专项↔项目 unlink | 接口 | 前端+后端 | BASE I06 顺延 I15；DELETE /api/inspection/links/specialty-object：404 if 不存在 | 规划 |

### M06.F03 检测参数

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F03.I01 | 检测参数列表 | 接口 | 前端+后端 | 展示参数原名、规范名、方法、单位和来源 | 已上线 |
| M06.F03.I02 | 检测参数新建/编辑 | 接口 | 前端+后端 | 维护自定义参数和官方参数本地配置，官方来源字段只读 | 已上线 |
| M06.F03.I03 | 检测参数删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F03.I04（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F03.I04 | 删除参数 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/inspection/parameters/{code}：保护官方及已引用参数（实现即原 M06.F03.I03） | 已上线 |
| M06.F03.I05 | 标准↔参数 link | 接口 | 前端+后端 | BASE 编号对齐：POST /api/inspection/links/standard-parameter：建立 standard→parameter 关联 | 已上线 |
| M06.F03.I06 | 标准↔参数 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/inspection/links/standard-parameter：404 if 不存在 | 已上线 |
| M06.F03.I07 | 参数↔界面 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/param-interfaces/links：404 if 不存在 | 已上线 |
| M06.F03.I08 | 标准↔参数 列表 | 接口 | 前端+后端 | BASE 编号对齐：GET /api/inspection/links/standard-parameter?inspectionStandardCode=&inspectionParameterCode=：按 standardCode/parameterCode 过滤 | 已上线 |

### M06.F04 检测标准

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F04.I01 | 检测标准列表 | 接口 | 前端+后端 | 展示标准编号、名称、版本、来源和核验状态 | 已上线 |
| M06.F04.I02 | 检测标准新建/编辑 | 接口 | 前端+后端 | 维护标准元数据和本地配置，不覆盖来源原文 | 已上线 |
| M06.F04.I03 | 检测标准删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I03=更新标准）；删除语义迁至 I09，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F04.I04 | 关联检测参数 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I04=删除标准）；标准↔参数 link 语义已在 M06.F03.I05/I06，无新行 | 已废弃 |
| M06.F04.I05 | 项目↔报告名称 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/report-names/links/object：404 if 不存在 | 已上线 |
| M06.F04.I06 | 报告名称↔参数 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/report-names/links/parameter：404 if 不存在 | 已上线 |
| M06.F04.I07 | 报告名称↔标准 unlink | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/report-names/links/standard：404 if 不存在 | 已上线 |
| M06.F04.I08 | 更新标准 | 接口 | 前端+后端 | BASE I03 顺延 I08；PUT /api/inspection/standards/{code} PATCH 语义 | 规划 |
| M06.F04.I09 | 删除标准 | 接口 | 前端+后端 | BASE I04 顺延 I09；DELETE /api/inspection/standards/{code}：204 if exists | 规划 |

### M06.F05 计算方法

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F05.I01 | 计算方法列表 | 接口 | 前端+后端 | 2 级树（检测项目→检测标准）+ 右侧列表（拖拽调整 sortOrder）；列：算法类型/试件数/备注 | 已上线 |
| M06.F05.I02 | 计算方法新建/编辑 | 接口 | 前端+后端 | 维护原始数据到检测结果的算法和适用条件 | 已上线 |
| M06.F05.I03 | 计算方法删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F05.I05（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F05.I04 | 更新计算方法 | 接口 | 前端+后端 | BASE 编号对齐：PUT /api/calculation-methods/{inspectionObjectCode}/{inspectionParameterCode}：PATCH 语义 | 已上线 |
| M06.F05.I05 | 删除计算方法 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/calculation-methods/{inspectionObjectCode}/{inspectionParameterCode}：删除未被引用的计算方法（实现即原 M06.F05.I03） | 已上线 |

### M06.F06 技术要求

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F06.I01 | 技术要求列表 | 接口 | 前端+后端 | 2 级树（检测项目→检测标准）+ 右侧列表（拖拽调整 sortOrder）；列：判定模式/限值/备注 | 已上线 |
| M06.F06.I02 | 技术要求新建/编辑 | 接口 | 前端+后端 | 维护单项评定条件、限值、表达式、来源和判定模式 | 已上线 |
| M06.F06.I03 | 技术要求删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位收敛，语义迁至 BASE 编号行 M06.F06.I05（本行 ID 保留作历史，不再挂新引用；后续锚点迁移另批） | 已废弃 |
| M06.F06.I04 | 更新技术要求 | 接口 | 前端+后端 | BASE 编号对齐：PUT /api/technical-requirements/{object}/{param}/{standard}：PATCH 语义 | 已上线 |
| M06.F06.I05 | 删除技术要求 | 接口 | 前端+后端 | BASE 编号对齐：DELETE /api/technical-requirements/{object}/{param}/{standard}：删除未被引用的技术要求（实现即原 M06.F06.I03） | 已上线 |

### M06.F07 报告名称

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F07.I01 | 报告名称列表 | 接口 | 前端+后端 | 展示 code/name/description/排序，按 sortOrder 排序，含关联项目/标准/参数计数 | 已上线 |
| M06.F07.I02 | 报告名称新建/编辑 | 接口 | 前端+后端 | 维护 code/name/sortOrder/description | 已上线 |
| M06.F07.I03 | 报告名称删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I03=创建报告名称）；删除语义迁至 I09，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F07.I04 | 关联检测项目 | 接口 | 前端+后端 | 维护 InspectionObjectReportName 中间表（2026-09-18 批次 2 注记：BASE I06=项目↔报告名称 link，本仓号顺延不变） | 已上线 |
| M06.F07.I05 | 关联检测依据 | 接口 | 前端+后端 | 维护 InspectionReportNameStandard role=TESTING（2026-09-18 批次 2 注记：BASE I07=报告名称↔标准 link（role=TESTING），本仓号顺延不变） | 已上线 |
| M06.F07.I06 | 关联判定依据 | 接口 | 前端+后端 | 维护 InspectionReportNameStandard role=JUDGMENT（2026-09-18 批次 2 注记：BASE I07=报告名称↔标准 link（role=JUDGMENT），本仓号顺延不变） | 已上线 |
| M06.F07.I07 | 关联检测参数 | 接口 | 前端+后端 | 维护 InspectionReportNameParameter 中间表；prefilter 弹窗（先选检测项目→过滤参数）+ 参数清单行追加「· 对象名」，见 REQ-2026-012（2026-09-18 批次 2 注记：BASE I08=报告名称↔参数 link，本仓号顺延不变） | 已上线 |
| M06.F07.I08 | 扩展属性维护 | 接口 | 前端+后端 | 维护 InspectionReportName.extFields 列表（key/label/type/required/tag/source/options）；预览前若样品 ext 未覆盖对应 key，会自动弹 SampleExtFieldsModal（M03.F01.I07）让用户补录（2026-09-18 批次 2 注记：BASE 无本行——本仓 extFields 补录弹窗为本地功能，BASE 无对应端点） | 已上线 |
| M06.F07.I09 | 删除报告名称 | 接口 | 前端+后端 | BASE I05 顺延 I09；DELETE /api/report-names/{code}：204 if exists | 规划 |

### M06.F08 参数界面

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F08.I01 | 参数界面列表 | 接口 | 前端+后端 | 展示 code/name/componentPath/关联参数，按 sortOrder 排序 | 已上线 |
| M06.F08.I02 | 参数界面新建/编辑 | 接口 | 前端+后端 | 维护 code/name/componentPath(模型 key)/config(JSON)/sortOrder/description | 已上线 |
| M06.F08.I03 | 参数界面删除 | 接口 | 前端+后端 | 2026-09-18 标记 已废弃：编号错位（BASE I03=创建参数界面）；删除语义迁至 I07，本行 ID 保留作历史，不再挂新引用 | 已废弃 |
| M06.F08.I04 | 关联检测参数 | 接口 | 前端+后端 | 维护 InspectionParameterParamInterface 中间表（参数↔界面 M:N，支持 reportNameCode 报告作用域）（2026-09-18 批次 2 注记：BASE I06=参数↔界面 link，本仓号顺延不变） | 已上线 |
| M06.F08.I05 | 参数界面预览 | 接口 | 前端+后端 | 列表行按钮：按绑定 componentPath 渲染该录入卡只读预览（mock 单样品 + 示例技术要求） | 已上线 |
| M06.F08.I06 | 参数界面预览弹窗 | 接口 | 前端+后端 | 模态：渲染注册的参数录入卡组件只读模式，供配置时查看录入卡样式 | 已上线 |
| M06.F08.I07 | 删除参数界面 | 接口 | 前端+后端 | BASE I05 顺延 I07；DELETE /api/param-interfaces/{code}：204 if exists | 规划 |

---

## 维护约定

- 谁改功能，谁改表，同一个 commit。
- `规划` → `开发中`：必须先有需求文档引用它。
- `开发中` → `已上线`：L5 会警告它缺设计映射与测试引用。警告不阻断，由人裁量。
- nextjs-as-backend：`/api/auth/*` 5 个 API route 是「家族定位要求」的功能，不是产品代码，不再单列 M98 段（ADR-0033 阶段二：infra 段自 tree 退役，由各仓自管）。
- BASE F 级下的 I 级子项镜像自 REF（backup/lab-management-system），只收父 F ∈ BASE 的行；BASE 外的 15 个 F 级段（老机构/角色/用户管理、人员/设备/设施、报告编制、旧报告类别/模板/标准/参数/技术要求、合同类别/计算方法/试件尺寸）不入本仓树，由 check_align 裁决锁定。
