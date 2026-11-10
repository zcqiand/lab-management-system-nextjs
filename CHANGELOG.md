# CHANGELOG — lab-management-system-nextjs

格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased] — 2026-11-07

### Fixed — seed:db 三处 ADR-0055/0056 漏网 + lab_dev 重灌 schema 化种子（2026-11-10）

- **现场**：ADR-0056 只 migrate 了表结构没灌种子（批记「数据零动」），lab_dev 库里
  param_interfaces.config 还是旧卡参数形状；跑 `npm run seed:db` 连炸三处——全是
  ADR-0055/0056 回放时 seed-db.ts 没跟着换血的漏网：
  1. fixtures 空串时间戳灌 timestamptz 列 → postgres.js date.serialize
     `new Date('')` RangeError（TEXT 时代合法值）→ buildRow 统一归一
     `2026-01-01T00:00:00Z`（rebaseline 种子变换同款 canonical）；
  2. objects 直挂列 inspection_specialty_code 已删（裁定 #5）→ 镜像旧键丢弃；
  3. 四小字典 + technical_requirements 去 tenant_id（裁定 #1，含 sso mirror
     追加行）→ GLOBAL_DICT_TABLES 丢键；顺手清 links 退役 config jsonb 残留。
- **lab_dev 已全量重灌**：28 表行数对账全 OK；param_interfaces.config 18/18
  schema 化（fields/computed/params），test_records 300 行全带 data。
- 挂账：`vendor/msw`（file: 安装名 @lab/management-system-msw）是独立 msw 仓
  2026-09-17 淘汰后的本仓残部、现役 /api 数据层，命名误导；候选改名 @lab/fixtures
  纯重构另批。

### Fixed — 登录后默认选中一个租户（SSO 裸 token 租户错位，2026-11-10 人裁）

- **现场**：SSO 回调按 ADR-0009 存 saas 原生 token（tenant_id claim = saas 租户
  UUID），而数据种子全挂 tenant key（tenant_key 收口批后形态）→ 租户过滤页全空
  且无报错（/data-entry 接样单 33 条滤成 0）。
- **修法**（auth-context）：`/me` hydrate 后 `currentTenantId ∉ tenants`（keyed
  列表）时自动 `switchTenant(首租户)` 换铸 keyed token；密码登录 keyed 会话不受
  影响（claim ∈ 列表即不触发）。fail-soft：switch 失败走既有 /me catch 分支。
- 新 fnTest ×2（M00.F02.I01 消费面：SSO 裸 token 自动切 / keyed token 不切）；
  TDD 先红后绿；相邻 auth 测试 4 文件 11 用例绿。

### Changed — 动态表单改造（ADR-0056 首仓回放，2026-11-10 人批 + 批中补充裁定）

**契约/DB 面（随 shared ADR-0056）**

- src/db/schema.ts 重 pull（component_path/is_official/sort_order/requirement_code/
  links.config 退役；version/data/links.inspection_standard_code 上位）；7 处纯
  CHECK 回调 `(table) =>` → `() =>`（pull 产物清理，非表结构改动）。
- orval 生成物重出（ParamInterface/TestRecord/ParamInterfaceLink 新形状）；vendor/msw
  gen:handlers 重出 + 手维护 shim/db schema/seeds/handlers-extra 同步（vendor orval
  input 路径仍断，本批以临时拷贝绕过，真修另批）。

**前端渲染链（component_path 退役落地）**

- 新 `DynamicFormRenderer` + `models/schema.ts`（FormSchema，8 种字段类型）+
  `models/algorithms.ts`（算法注册表 17 键，`computed.variant ?? algorithm` 派发——
  variant 是本仓扩展，DB CHECK 把 algorithm 钉死 7 枚举）。
- **11 张硬编码卡 + MODEL_REGISTRY 退役**（13 文件删除）；纯算法函数
  （cement-strength/rebar-mechanics/rebar-welding/concrete/gradation/soil）保留为
  算法域。提炼映射：水泥卡→gb17671_compress/flexural、混凝土抗压→compressive_strength、
  抗渗→permeability_grade（GB/T 50082-2009）、级配→gradation、钢筋力学→steel_tensile/
  elongation/yield_ratio、焊接→welding_tensile/bend、土工→compaction_peak/compaction_degree。
- DataEntryPage/ReceiptDetail/ParamInterfacePreviewModal 改走 DynamicFormRenderer；
  resolveInterfaceByParam 重写为三级作用域特异性（inspectionStandardCode 精确命中 >
  reportNameCode > 通用兜底，无 sortOrder）。
- 渲染器 onChange 上报 `{data, result: JSON.stringify(data), verdict, requirement}`——
  data=采集原值+计算产物（=旧卡 result JSON 形状，报告链两路取数皆通）；
  result 过渡期继续承载 JSON 形（data 为 SSOT，见报告链过渡债）。

**报告模板链（result JSON 解析 → rec.data 直取）**

- reportTemplateData 6 处取数源迁 rec.data（免 JSON.parse）；`record:`/`srecord:`
  模板 path 语法不变；迁移期 result 老 JSON 串兜底（已加测试锁定回退路径）。
- reportTemplateSeed MockResult 增 data；ReportPreviewModal 纯透传零改动。

**后端路由 + 测试基建**

- param-interfaces POST：code 必填 + config 对象校验（数组拒 400）+ version ?? 1；
  [code] DELETE 去「内置不可删」isOfficial 门；links 路由去 config、加
  inspectionStandardCode（GET 过滤 + POST 写入）。
- tests/helpers/seed.ts / types 镜像 / src/data/generated 同步；新增
  tests/api/param-interfaces-route.test.ts（先红后绿 3 fnTest）。
- 全量 vitest 78 文件 530 测试绿（+1 skip 既有）；tsc 全仓绿。

### Changed — DB 六裁定回放（ADR-0055，shared re-baseline 后首仓回放，2026-11-10）

**src/db/schema.ts（pull 产物，入 git）**

- `bash scripts/pull-schema.sh`（PG 指向重打后的 lab_dev）重出；随 shared 六裁定
  全量换血（详见 shared CHANGELOG / suite ADR-0055）。7 处纯 CHECK 回调
  `(table) =>` → `() =>`（drizzle-kit pull 对无索引表省略 table 参数的未用清理，
  非表结构改动）。

**src/lib/db-queries.ts**

- **catalog 四表全局共享**（六裁定 #1/#2 人批）：catalogCfg 去 tenantCol，
  dict 层 `if (cfg.tenantCol)` 守卫自动忽略 tenantId 参数；认证 401 边界不变，
  数据面全局。DictCfg 新增 `junctionDirect` 机制（`exists where from=<值> and
  to=code` 的真值匹配，区别于 reverse「挂链即保留」怪癖语义）；objects
  `?inspectionSpecialtyCode=` 直挂列退役后走 junction 值过滤（六裁定 #5）。
- **时间列空串兜底退役**（timestamptz 化连带，4 处）：createReportNameDb /
  updateReportNameDb / createContractDb / updateContractDb 的 `?? ""` →
  缺省 `new Date().toISOString()`（'' 现为 PG 22007 非法输入）。

**seeds 双源同步 + 测试回放（改测试理由：断言钉死已退役列语义）**

- src/seeds 同步 shared 变换后种子；两个 JSON 以本仓 prettier 规范形为准写回
  shared（两仓 prettier 规范形不一致，parity 门字节等双向成立）。
- tests/api/dict-pg.test.ts：objects 种子去直挂列；brands 种子去 tenant_id；
  「catalog tenant 隔离」用例重写为「全局共享」语义（tenantId 断言退役）。
- tests/api/receipts-pg.test.ts：合同种子显式补 tenant_id（六裁定 #8——
  default '' 废除后 notNull，缺失不再有兜底）。
- 全量 vitest 80 文件 536 测试全绿；gate L0-L5 全绿 exit 0。

### Fixed — legacy-client token 注入刷新即失（2026-11-09 事故修复，TDD 先红）

**事故指纹**：`/inspection-specialties` 刷新后恒 401（`Request failed with status code 401`），
重登无效。端到端定谳：BFF/数据/新签 token 全部健康（curl 登录 → 带 token 调
specialties 200），病灶在前端注入链——

- `src/api/legacy-client.ts` 请求拦截器注入的是**模块作用域 `currentToken`**，
  只在登录瞬间被 `setToken`；页面刷新后模块重置为 null，且从不从 localStorage
  （`lab.token`）回填。检测能力页等 legacy 页面全部取数走 apiClient → 裸发 →
  msw worker（NEXT_PUBLIC_API_MODE=msw）requireBearer 401。
- orval 链路（http-client 拦截器直读 localStorage）一直正常——同 token 两条链
  一活一死，分叉即病灶。

**修复（SSOT=backend-config.getToken()）**

- 两个拦截器（apiClient/identityClient）改为每请求直读 localStorage（与
  installHttpClient 同源同 key）；登出/切后端清 key 后下一请求即生效，无内存残留。
- `setToken()` 保留（登录页调用面不变），改为同步写 localStorage 完成持久化。
- 新测试 `tests/api/legacy-client-token.dom.test.ts`（TDD：redcheck 认证红后转绿，
  3 例——预置 token 请求自带 Bearer / localStorage 清除无残留 / setToken 写盘；
  axios per-request adapter 捕获，零网络）。
- `tests/api/auth.dom.test.tsx` M01.F05.I02 源码形状正则随实现收紧放宽
  （`Authorization.*Bearer.*currentToken` → `Authorization.*Bearer`；旧正则钉死
  已退役的模块变量名；行为级覆盖由新测试承担）。
- gate L0-L5 全绿 exit 0（206 条目）。

**本批顺带定谳、另批处理的账**

- **SSO callback 签发分叉**：SSO 路径 token 的 tenant_id 是 saas 原始 UUID，
  原生登录路径已按 2026-10-20 人裁解析为 tenant_key（acme）——callback 未做
  同款解析（本批实测：浏览器 SSO token=UUID，curl 原生 token=acme）。非本事故
  根因（requireTenant 只查非空），一致性债另批。
- **refresh 自愈缺口**：`POST /api/auth/refresh` 后端在、orval `authRefresh`
  客户端在，全仓零调用方；token TTL 1h 过期后无自动续期，页面甩 axios 原始
  401。修法（401 → authRefresh 自愈 → 失败跳 /login）另批 TDD。

### Added — M05.F01.I05 见证取样跟踪落地（B 通道，2026-11-07 人裁；接上批「明确不动」项，按已上线方式制作）

**实现（TDD 三面先红后绿，redcheck.py 双红认证）**

- `src/lib/summary-witness.ts`（新）：`computeWitnessStats(receipts, contracts)` 纯函数。
  语义（家族首发定义，BASE 契约化前以此为准）：需见证 = 合同见证人已安排
  （contract.witness 非空）；已见证 = 接样单 witness 已登记；见证率 = witnessed/require
  （三位小数四舍五入，分母 0 → 0）；明细逐单带合同回退（见证单位/见证人自合同带出，
  接样单字段可覆盖工程名；孤儿接样单安全剔除）。
- `src/app/api/summary/stats/route.ts`：GET 响应扩展
  `witnessStats:{requireWitness, witnessed, witnessRate, details[]}`。
- `src/features/summary/SummaryPage.tsx`：I05 区块（`data-fn="M05.F01.I05"` +
  witness-tracking/witness-rate/witness-details 锚），插在 I04 与 I01 之间；
  `StatsWithWitness = DashboardStats & { witnessStats?: WitnessStats }` 交集投影读扩展字段
  （生成物文件零改动）。
- `vendor/msw/src/handlers-extra.ts`：/summary/stats handler 同款镜像（vendor 不 import 仓内
  lib，语义内联复制——**两处同步**，语义改动须双改）。
- 测试三件：`tests/lib/summary-witness.test.ts`（纯函数 4 例）、
  `tests/api/summary-witness-stats.test.ts`（匿名 401 + SSO token 形状不变式；
  标题不含 M/F/I 字面量，fnReporter 正则会误吞）、
  `tests/features/summary/summary.dom.test.tsx` 新增 I05 fnTest（server.use 注入固定载荷，
  断言 50.0% + 2 明细行）。合计 11/11 绿。

**B 通道契约债（ADR-0029 合规留痕，2026-11-07 人裁「B：本仓路由层扩展」）**

- witnessStats **在 shared DashboardStats 契约之外**（`shared/tsp/routes/summary.tsp` 未动；
  该文件 L15 注释本就预留 witness 输出走此端点）。本仓以路由层扩展 + 交集投影过渡。
- **兄弟仓实现 I05 时必须走 shared tsp 正门**（把 witnessStats 收进 DashboardStats →
  人批 → 全家族重生成），不得复制本仓 B 通道形状；shared 批后本仓删除
  `WitnessStats`/`StatsWithWitness` 投影类型转正。
- contract-test 仓同步断言 witnessStats 形状——随 shared 契约化一并做，本批未动
  （contract-test 只断言 shared 契约面）。

**树翻转（tree-change 人批通道，第三笔提案）**

- M05 模块行 + M05.F01.I05 规划→已上线（规划→已上线直翻 = mirror 免批类外 → 人工
  --approve，令牌绑 sha 5ab301b6 用后焚）。上批「明确不动」两项至此收口。
- 复跑 gate L0-L5 全绿 exit 0（206 条目；软告警 54 条，52 条既有债 + I05 落地新增
  2 条无设计映射类，见 .state/alignment.json）。

**suite 工具修复（xr-code-suite 仓，非本仓）**

- `scripts/redcheck.py`：Windows 下 bare `subprocess.run(["npx",...])` 报
  FileNotFoundError（npx.cmd 不经 shell 不解析）→ redcheck exit 2「测试命令跑不起来」。
  修法照抄 harness.py：nt 下引号拼接 + `shell=True`。工具修复非门禁放宽。

### Changed — 功能树父行补账 + 双胞收敛修正（tree-change 人批通道，两笔提案）

**树状态补账（21 行，docs/functions/function-tree.md）**

- **M00 父行 3 行**（M00 / M00.F01 / M00.F02）规划→已上线——子项 F01.I01 / F02.I01
  早已上线（3a9f120：/auth/me hydrate + TenantSwitcher + LabJwtSigner 真 HS256 换发），
  父行掉队；shared BASE 同三行已上线。
- **M01-M06 补账 17 行**（人批提案②，gate 红后修正 1 行后为 17 行已上线 + 1 行已废弃）：
  - 模块行 5 行：M01 / M02 / M03 / M04 / M06 规划→已上线
  - 功能行 2 行：M01.F04 / M01.F05 规划→已上线（子项全上线）
  - 子项 10 行→已上线：M02.F01.I07（PUT /api/contracts/[id]）、
    M03.F03.I16（PUT /api/samples/[id]）、M03.F03.I17（DELETE /api/samples/[id]）、
    M06.F02.I11/I12（objects/[code] DELETE/PUT）、M06.F02.I15（links/specialty-object DELETE）、
    M06.F04.I08/I09（standards/[code] PUT/DELETE）、M06.F07.I09（report-names/[code] DELETE）、
    M06.F08.I07（param-interfaces/[code] DELETE）——逐行 grep 实测 handler 在库，非照清单抄
- **M03.F03.I15 双胞收敛**：已上线→**已废弃（并入 M03.F03.I07）**。
  I15 与 I07 同名同语义（数据录入三态过滤器），I07 已上线且带 UI 锚
  （src/features/data-entry/DataEntryPage.tsx:709/718 `@entry` + `filterDataFn`）；
  I15 是双胞收敛批漏翻残留，曾误翻已上线 → 触发 L5 unreachable_shipped 硬红
  （面向用户子项无 UI 入口锚）→ 人裁废弃修正。本行 ID 保留作历史，不再挂新引用。
- **明确不动**：M05.F01.I05（见证取样跟踪——witnessStats 未实现，summary/stats/route.ts
  仅 GET；BASE 同行规划 = 真实规划非掉队）、M05 模块行（随子项留规划）。

**过程注记**

- 两笔提案均走人工 --approve（规划→已上线属 mirror 免批类外；废弃永远人裁），
  提案留档 .state/tree-change.json，令牌用后焚。
- 开工时清理过一份失效残留提案（REQ-2026-023 M01.F05.I06 GA 翻转，令牌 sha 失效，
  翻转早已随 504c4c2 落库）。

**门禁结论**

- `python scripts/gate.py -p lab-management-system-nextjs` L0-L5 全绿 exit 0
  （206 功能条目；软告警 52 条属既有欠账——「已上线但无设计映射/无测试引用」类，
  非本批新增，见 .state/alignment.json）。

### 兄弟仓同步清单（「同步其他仓」照单回放，不依赖会话记忆）

以下挂点均为 2026-11-07 当轮 grep 实测：

**legacy-client token 注入修复（2026-11-09 批新增）**

- **lab-react / lab-vue**：检查自家 legacy 客户端（REF `src/api/client.ts` 移植形态）
  是否同样持有**模块作用域 token 变量、只登录时 set 不刷新回填**——同款指纹
  （legacy 页面刷新 401 / orval 链路正常）即回放本修复：拦截器直读 localStorage
  SSOT + setToken 写盘。nextjs 本批测试配方（axios per-request adapter 捕获）
  可直接照抄。
- **lab-aspnetcore / springboot / rails**：后端仓无此链路，无需回放。

**I05 见证取样跟踪（本批新增，兄弟仓按角色取舍）**

- **语义定义真源** = 本仓 `src/lib/summary-witness.ts`（家族首发）；实现锚 = route.ts
  扩展字段 + SummaryPage I05 区块（完整证据链见上方 Added 节）。
- **兄弟仓是否跟随**：nextjs 是全量镜像仓——前端类 I05 页面归前端仓（react/vue/angular），
  后端类 stats 扩展归后端仓（aspnetcore/springboot/rails/fastapi/laravel/go/ktor 等）。
  跟随时**必须先走 shared tsp 正门**（witnessStats 收进 DashboardStats 奴族重生成），
  不得复制 B 通道形状（见 Added 节契约债）。
- **contract-test 仓**：witnessStats 形状断言随 shared 契约化一并加，本批未动。

- **lab-react**：`docs/functions/function-tree.md` M00 模块行 规划→已上线
  （F01/F02 已上线实测）；M01-M06 模块行 规划（掉队面同款，**翻前须逐行核本仓
  实现**——nextjs 仓是全量镜像，兄弟仓交付面不同，不可照抄本批结论）。
- **lab-vue**：同文件 M00 模块行 + M00.F01 规划→已上线（F02 已上线实测）；
  M01-M06 模块行同款待核。
- **lab-aspnetcore / lab-springboot / lab-rails**：M00 模块行 规划→已上线
  （F01/F02 已上线实测）；M01-M06 模块行 规划（掉队面同款待核）。
- **shared（BASE）——shared 树变更须人批，本批未动**：
  M01/M02/M03/M05/M06 模块行 BASE=开发中（本仓已先行翻已上线，BASE 侧 GA 待人裁）；
  M03.F03.I15 BASE=开发中（本仓已废弃双胞收敛；BASE 侧 I07/I15 形状与本仓可能不同，
  回放前先核 BASE 树再裁）。
- **不动项**：saas-nextjs 全树无规划/开发中行，本批无需回放；lab 家族交付列按仓角色
  （nextjs=全量镜像，后端仓仅后端类、前端仓仅前端类），兄弟仓回放以本仓实现证据为准。

## [0.3.56] — 2026-09-04

- **ADR-0020 family-wide 真库分层**：测试用 lab_test 库（共享 PG），连不上即失败不 skip。
  - `tests/setup.ts` / `tests/db.smoke.test.ts` 默认 DATABASE_URL 改为
    `postgresql://...@100.79.128.25:5432/lab_dev` → `.../lab_test`。lab_dev 仅当
    DATABASE_URL 显式设置时使用（开发手动 seed）。
- **fix(test)**：receipts-pg.test.ts 去 CI skip，改 requireReachable + 自播种子 +
  marker cleanup。家族模式与 lab-springboot/saas-springboot 的 RepositoryPgTest
  同款（真方言 + inline 种子 + 显式 cleanup，无 in-memory fallback）。原 `describe.skipIf(isCi)`
  删 —— 用户原则「测试走 memory 分支 = 默认兜底 = 隐藏 bug 的重大隐患」,
  CI=编译+mock / gate=真库 的分层改在 CI workflow 的 `--exclude` 决定（与 .NET
  `[Trait("Category","RealDb")]` + `--filter "Category!=RealDb"` 同款）。
- **fix(test infra)**：postgres-js jsonb binding —— `${jsonString}::jsonb` 在 tagged 模板
  里被 postgres-js 当 unknown literal 包装，"cannot extract elements from a scalar"。
  改 `${s.json(jsArray)}` 让 postgres-js 走 tagged 模板的 JS-对象序列化路径
  （与 seed-db.ts L200-211 同款教训）。
- **fix(me/route.ts)**：snapshot code/name pass-through 修复 ADR-0019 P2 debt。
  原版永远用 `DEMO_TENANTS_FULL` 兜底覆盖 snapshot，SSO 路径（tenantId 非
  TENANT-00x）的 code/name 被 strip → 4-way contract-test 必现 me/tenants
  `{tenantId, roleIds}` vs msw 返 `{tenantId, code, name, roleIds}`。改：
  snapshot 自带优先，DEMO_TENANTS_FULL 仅在 snapshot 缺值时补。
- **fix(login/route.ts)**：demo 路径写 snapshot 时也带 code/name（与 sso/callback
  写入路径对齐 —— 双源都补齐后 me/route.ts pass-through 才有意义）。
- **fix(ci)**：`.github/workflows/ci.yml` L4 加 `--exclude='tests/api/receipts-pg.test.ts'`
  —— CI 跑编译+mock+smoke，gate 跑真库 mutate。db.smoke.test.ts 保留跑（仅
  lab_smoke schema 自洁，不污染 public）。

## [0.3.55] — 2026-08-27

- M01.F04.I04 前端失败语义改为上抛错误，不再静默回退静态树（与 react/vue 仓同款）：
  - `useBackendMenus` 拉取失败保留 error state，render 阶段 `if (error) throw error`
  - 401 走 hook 内 `clearToken() + window.location.assign('/login')`，**不**写
    error state（避免 render throw 破坏重定向；token 过期不该给用户看错误界面）
  - 新增 `AppShellErrorBoundary` 渲染「菜单加载失败」错误态（图标 / msg / 提示）
  - AppShell：menusLoading 渲染「菜单加载中…」aside；不再 `?? []` 兜底
  - `MenuStatusBanner` 不读 error（避免 Banner 自身触发 render throw）
  - 测试 sidebar-nav.direct.dom.test.tsx：500 miss → ErrorBoundary 接住 → 错误态；
    401 → 仍 clearToken + 重定向 /login（保留旧断言）

## [0.3.54] — 2026-08-27

- 初始化台账：Next.js 15 全栈仓（前端 + API routes）。历史变更见 git log 与 `.state/session.json`。
