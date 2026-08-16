# nextjs API routes 接 lab_dev（pg）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 lab-management-system-nextjs 的 42 个业务 API routes 从 msw fixtures（in-memory）切到 lab_dev（PostgreSQL）真读写。

**Architecture:** 新增 `src/db/index.ts`（postgres-js + drizzle 单例，对齐 saas）+ `src/lib/db-queries.ts`（集中数据访问层，row↔DTO 映射 + 三态流转 SQL）+ `scripts/seed-db.ts`（msw 种子灌库）。42 个路由改为调用 db-queries；api-helpers 保留纯工具函数。auth/saas/org-info/health 路由不动。

**Tech Stack:** Next.js 15 Route Handlers / postgres-js（drizzle-orm/postgres-js）/ drizzle-kit pull 产物 `generated/schema.ts` / tsx / vitest

**Spec:** `docs/superpowers/specs/2026-08-16-nextjs-api-pg-backend-design.md`

## Global Constraints

- 所有工作在 `output/lab-management-system-nextjs/` 内完成（除 Task 12 的 suite 门禁）；msw/shared/react/vue 仓**零改动**
- npm 依赖一律走 `registry.npmmirror.com`
- **禁止提交 `generated/`**（gitignored；`node scripts/emit-schema.mjs` 或 `npx drizzle-kit pull --config=drizzle.config.pg.ts` 重出）
- **禁止手写 DDL**：表结构真源是 `../lab-management-system-shared/sql/migrations/V*.sql`
- 禁改 `.harness/stack.json` 放宽门禁；skip 的测试不挂功能 ID
- pg 连接：`DATABASE_URL`（.env 已有 `postgresql://postgres:postgres@localhost:5432/lab_dev`）；脚本直跑 fallback `postgres:qiand68+++@100.79.128.25:5432/lab_dev`（drizzle.config.pg.ts 同款）
- 本机 pg_dump 版本坑：`emit-schema.mjs` 的 pg_dump 步骤会因 server 16 vs 本机 14 失败——`generated/schema.ts` 用 `npx drizzle-kit pull` 单独出（已验证可用），不要依赖完整 emit-schema
- **重要边界**：`/api/*` 只在 nextjs 模式被命中（msw 模式浏览器层拦截），路由无条件接 pg，无双源开关
- 不动的路由（13 个）：`auth/{login,logout,me,menus,permissions,refresh,switch-tenant,sso/authorize,sso/callback}`、`saas/{app,me/menus}`、`org-info`、`health`
- 要改的路由（42 个文件，`grep -rln "management-system-msw/fixtures" src/app/api/` 的完整清单）：
  contracts(2) / receipts(5) / samples(2) / test-records(3) / catalog(8) / inspection 主表(8) / inspection links(4) / report-names(4) / inspection-param-interfaces(3) / calculation-rules(2) / technical-requirements(2) / summary(2) — 数目按 grep 实际为准
- 语义基线：每个路由改造前先读它的现实现 + 头部注释（注释里有语义出处），SQL 版必须逐参数对齐
- DB 表结构关键事实（generated/schema.ts 已验证）：26 张表、列名 snake_case（drizzle 映射 camelCase 属性）、`flow_history`/`test_parameters`/`judgmentBasis` 等 jsonb、`tenant_id` 仅业务表有（V012，10 张：contracts/sample_receipts/samples/test_records/4 catalog/inspection_technical_requirements/audit_events），M06 字典表无 tenant_id
- msw 种子关键事实：26 个 JSON（sample-receipts/samples/test-records 为空数组，receipts 由 flow-matrix 派生 210 条 + fixtures 合并导出）、字段 camelCase、id 全 text、`TENANT-001`
- tenant 常量：fixtures 种子统一 `TENANT-001`；db 层查询用同一常量

---

### Task 1: postgres-js 依赖 + db 单例（改写现有 src/db/index.ts）

**Files:**
- Modify: `package.json`（deps 加 `postgres`，devDeps 删 `pg`，scripts 加 `seed:db`）
- Modify: `src/db/index.ts`（pg+node-postgres → postgres-js，全文重写）
- Modify: `src/db/schema.ts`（占位 → re-export generated）

**Interfaces:**
- Consumes: `generated/schema.ts` 的 `pgTable` 导出（`sampleReceipts`、`contracts` 等 camelCase 属性名）
- Produces: `db`（drizzle 实例，`Database` 类型）+ `schema`（re-export）。后续所有任务 `import { db, schema } from "@/db"`

- [ ] **Step 1: 安装 postgres-js、删 pg devDep**

```bash
cd output/lab-management-system-nextjs
npm install postgres@^3.4.5 --registry=https://registry.npmmirror.com
npm uninstall pg
```

注意：`pg` 会以 drizzle-orm 传递依赖留在 node_modules 顶层（已验证 `npm ls pg` → 8.23.0 deduped），sync-db.mjs 借链不受影响。

- [ ] **Step 2: 改写 src/db/index.ts**

```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DB client — postgres-js + drizzle-orm（对齐 saas-identity-platform-nextjs/src/db/index.ts）。
//
// 「server-only」：只允许 Route Handler / Server Action / Server Component 引入；
// vitest 由 tests/server-only.stub.ts alias 兜底。
// pg（node-postgres）不再被本仓直接依赖：sync-db.mjs 借链用的是 drizzle-orm 的
// 传递依赖 pg（node_modules 顶层 deduped）。
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. See docs/conventions/nextjs.md §凭据 (ADR-0009).",
  );
}

const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
```

- [ ] **Step 3: 改写 src/db/schema.ts**

```ts
// re-export drizzle-kit pull 产物（generated/schema.ts，gitignored）。
// 与 src/api/endpoints/ 同款消费模式：新 clone 后先跑
//   npx drizzle-kit pull --config=drizzle.config.pg.ts
// （drizzle.config.pg.ts 的 schema 字段历史指向本文件，pull 时本文件是空 array 即可——
//  所以保留下面的占位导出，pull 不会覆盖本文件，只写 generated/。）
export const pgSchema = [];
export * from "../../generated/schema";
```

- [ ] **Step 4: package.json scripts 加 seed 入口（Task 5 实现脚本本体）**

```json
"seed:db": "tsx scripts/seed-db.ts"
```

- [ ] **Step 5: 验证编译 + db 单例可连**

`npx tsc --noEmit`（需先 `npx drizzle-kit pull --config=drizzle.config.pg.ts` 出 generated/schema.ts）。
再写一次性 node 脚本验证（不提交）：

```bash
npx tsx -e "import('postgres').then(async m => { const c = m.default(process.env.DATABASE_URL ?? 'postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev'); const r = await c\`select count(*) from information_schema.tables where table_schema='public'\`; console.log('tables:', r[0].count); await c.end(); })"
```

Expected: tables ≥ 26（或 lib_dev 现有表数）

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/db/
git commit -m "feat(db): postgres-js 单例对齐 saas — pg 移出直接依赖（借链走传递依赖）"
```

---

### Task 2: row↔DTO 映射器（db-queries 基石）

**Files:**
- Create: `src/lib/db-map.ts`（**纯函数，零 import**——seed 脚本也要用，不能拖进 @/db 的 server-only 链）
- Create: `src/lib/db-queries.ts`（先只有 re-export，后续任务追加域函数）
- Test: `tests/api/db-map.test.ts`

**Interfaces:**
- Consumes: 无（纯函数）
- Produces（定义在 db-map.ts，db-queries re-export）:
  - `toCamel(s: string): string`（snake_case → camelCase）
  - `toSnake(s: string): string`（camelCase → snake_case）
  - `rowToDto<T = Record<string, unknown>>(row: Record<string, unknown>): T`（snake 列 → camel 键；jsonb 列已由 drizzle 反序列化为 JS 值，直通）
  - `dtoToRow(obj: Record<string, unknown>): Record<string, unknown>`（camel → snake；值不改写）
  - 常用别名表 `PG_TABLES`：`{ contracts: "contracts", receipts: "sample_receipts", samples: "samples", testRecords: "test_records", ... }`（seed 脚本与查询层共用）

- [ ] **Step 1: 写失败测试**

```ts
// tests/api/db-map.test.ts
import { describe, it, expect } from "vitest";
import { toCamel, rowToDto, dtoToRow } from "@/lib/db-map";

describe("row↔DTO 映射", () => {
  it("toCamel: snake → camel", () => {
    expect(toCamel("contract_code")).toBe("contractCode");
    expect(toCamel("inspection_specialty_code")).toBe("inspectionSpecialtyCode");
    expect(toCamel("code")).toBe("code");
  });
  it("rowToDto: 整行 snake → camel，值原样", () => {
    const row = { contract_code: "C-1", client_unit: "甲", flow_history: [{ action: "submit" }] };
    const dto = rowToDto(row);
    expect(dto).toEqual({ contractCode: "C-1", clientUnit: "甲", flowHistory: [{ action: "submit" }] });
  });
  it("dtoToRow: camel → snake", () => {
    expect(dtoToRow({ contractCode: "C-1", flowHistory: [] })).toEqual({
      contract_code: "C-1", flow_history: [],
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/api/db-map.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现（db-queries.ts 第一块）**

```ts
// src/lib/db-queries.ts — DB 数据访问层：row↔DTO 映射 + 各路由域查询/写入函数。
// 语义真相源 = 各 route.ts 头部注释所引的 lab-msw handler 行为。
import { db, schema } from "@/db";

export const TENANT = "TENANT-001";

export function toCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
export function toSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
export function rowToDto<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}
export function dtoToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v;
  return out;
}

// drizzle select 返回的行已是 camelCase 属性（generated/schema.ts 映射），但为
// 统一形状（含 jsonb 直通），路由层统一走 rowToDto 兜底命名转换。

export const PG_TABLES = {
  contracts: "contracts",
  receipts: "sample_receipts",
  samples: "samples",
  testRecords: "test_records",
  brands: "inspection_brands",
  models: "inspection_models",
  specs: "inspection_specs",
  grades: "inspection_grades",
  technicalRequirements: "inspection_technical_requirements",
  specialties: "inspection_specialties",
  objects: "inspection_objects",
  specialtyObjects: "inspection_specialty_objects",
  parameters: "inspection_parameters",
  standards: "inspection_standards",
  objectParameters: "inspection_object_parameters",
  objectStandards: "inspection_object_standards",
  standardParameters: "inspection_standard_parameters",
  calculationRules: "inspection_calculation_rules",
  reportNames: "inspection_report_names",
  objectReportNames: "inspection_object_report_names",
  reportNameStandards: "inspection_report_name_standards",
  reportNameParameters: "inspection_report_name_parameters",
  paramInterfaces: "inspection_param_interfaces",
  paramInterfaceLinks: "inspection_param_interface_links",
  auditEvents: "audit_events",
} as const;
void db; void schema;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/api/db-map.test.ts`
Expected: PASS 3

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-map.ts src/lib/db-queries.ts tests/api/db-map.test.ts
git commit -m "feat(db): row↔DTO snake/camel 映射器 + PG_TABLES 常量"
```

---

### Task 3: seed 脚本（msw 种子 → lab_dev）

**Files:**
- Create: `scripts/seed-db.ts`
- Test: 手动跑 + 对账输出（无独立测试文件；Task 11 集成测试会复用灌好的库）

**Interfaces:**
- Consumes: `@lab/management-system-msw/fixtures` 的全部导出数组（`sampleReceipts` 含 flow-matrix 派生 210 条）；`PG_TABLES`（Task 2）
- Produces: 可执行 `npm run seed:db`；幂等（TRUNCATE 全表再灌）；退出码 0=对账一致

- [ ] **Step 1: 写 scripts/seed-db.ts**

核心结构（完整实现，按此落）：

```ts
// scripts/seed-db.ts — 把 @lab/management-system-msw/fixtures 灌到 lab_dev。
// 幂等：TRUNCATE 全部 26 张表 RESTART IDENTITY CASCADE 再灌。
// 对账：灌完逐表 SELECT count(*) 与 fixtures 行数比对，不一致 exit 1。
import { config } from "dotenv";
config(); // .env → DATABASE_URL
import postgres from "postgres";
import {
  contracts, tenants, sampleReceipts, samples, testRecords,
  inspectionBrands, inspectionModels, inspectionSpecs, inspectionGrades,
  technicalRequirements, inspectionSpecialties, inspectionObjects,
  inspectionParameters, inspectionStandards, inspectionSpecialtyObjects,
  inspectionObjectParameters, inspectionObjectStandards, inspectionStandardParameters,
  inspectionCalculationRules, inspectionReportNames, inspectionObjectReportNames,
  inspectionReportNameStandards, inspectionReportNameParameters,
  inspectionParamInterfaces, inspectionParamInterfaceLinks,
} from "@lab/management-system-msw/fixtures";
import { toSnake } from "../src/lib/db-map";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev";
const sql = postgres(DATABASE_URL, { max: 1 });

// 表 → fixtures 数组（顺序 = FK 拓扑：字典先于业务，主表先于 junction）
const PLAN: Array<[string, Array<Record<string, unknown>>]> = [
  ["inspection_specialties", inspectionSpecialties],
  ["inspection_objects", inspectionObjects],
  ["inspection_parameters", inspectionParameters],
  ["inspection_standards", inspectionStandards],
  ["inspection_report_names", inspectionReportNames],
  ["inspection_param_interfaces", inspectionParamInterfaces],
  ["inspection_calculation_rules", inspectionCalculationRules],
  ["inspection_technical_requirements", technicalRequirements],
  ["inspection_brands", inspectionBrands],
  ["inspection_models", inspectionModels],
  ["inspection_specs", inspectionSpecs],
  ["inspection_grades", inspectionGrades],
  ["contracts", contracts],
  ["sample_receipts", sampleReceipts],
  ["samples", samples],
  ["test_records", testRecords],
  ["inspection_specialty_objects", inspectionSpecialtyObjects],
  ["inspection_object_parameters", inspectionObjectParameters],
  ["inspection_object_standards", inspectionObjectStandards],
  ["inspection_standard_parameters", inspectionStandardParameters],
  ["inspection_object_report_names", inspectionObjectReportNames],
  ["inspection_report_name_standards", inspectionReportNameStandards],
  ["inspection_report_name_parameters", inspectionReportNameParameters],
  ["inspection_param_interface_links", inspectionParamInterfaceLinks],
  // audit_events 无种子（fixtures 派生路由也不读它），灌空
  ["audit_events", []],
];
// tenants：lab 库不建 tenants 表（V012 注释：租户真相源在 saas），跳过 tenants fixtures。

async function insertTable(table: string, rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const cols: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) cols[toSnake(k)] = v;
    const keys = Object.keys(cols);
    // 数据库列集（text NOT NULL DEFAULT '' 的列缺值时补 ''，防 INSERT 报错）
    const vals = keys.map((k) => (cols[k] === undefined ? "" : cols[k]));
    await sql`insert into ${sql(table)} (${sql.unsafe(keys.map((k) => `"${k}"`).join(", "))})
      values (${sql.join(vals.map((v) => sql`${v}`), sql`, `)})`;
  }
}

async function main() {
  const allTables = PLAN.map(([t]) => t);
  await sql`truncate table ${sql.unsafe(allTables.map((t) => `"${t}"`).join(", "))} restart identity cascade`;
  for (const [table, rows] of PLAN) await insertTable(table, rows);
  // 对账
  let bad = 0;
  for (const [table, rows] of PLAN) {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
    const ok = n === rows.length;
    if (!ok) bad++;
    console.log(`${ok ? "OK " : "BAD"} ${table}: db=${n} fixtures=${rows.length}`);
  }
  await sql.end();
  process.exit(bad ? 1 : 0);
}
main();
```

实现注意：
- 上面是骨架，落地时逐表核对 DDL NOT NULL 列 vs fixtures 字段（如 `inspection_objects.source_project_no NOT NULL` vs seed 是否带 `sourceProjectNo`）——缺的补 `""`/`0`/`false` 默认值，映射在 `insertTable` 前的 per-table `fillDefaults` 里做，不污染 toSnake 通用层
- `flow_history`/`test_parameters` 等 jsonb 列：postgres-js 传 JS 数组/对象自动序列化
- 逐行 insert（约 4300 行）够用，不必批量优化
- datetime 列全是 text（DDL 约定），ISO 字符串直插

- [ ] **Step 2: 跑 seed**

```bash
npm run seed:db
```

Expected: 每行 `OK <table>: db=N fixtures=N`，exit 0。重点核对 `sample_receipts: db=210`（flow-matrix 派生）。若 FK 报错，把该表在 PLAN 里前移到依赖表之后（V011 backwire 约束）。

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-db.ts package.json
git commit -m "feat(seed): seed-db.ts 灌 msw fixtures（含 flow-matrix 210 receipts）到 lab_dev"
```

---

### Task 4: receipts 域查询层（三态流转 SQL——最难的一块）

**Files:**
- Modify: `src/lib/db-queries.ts`（追加 receipts 域函数）
- Test: `tests/api/receipts-pg.test.ts`

**Interfaces:**
- Consumes: `db`, `schema.sampleReceipts`（generated），Task 2 映射器
- Produces:
  - `listReceiptsDb(q: { flowStatus?: string; contractId?: string; categoryCode?: string; lastSubmittedBy?: string; operator?: string; keyword?: string; filter?: string; page: number; pageSize: number }): Promise<{ items: Record<string, unknown>[]; page: number; pageSize: number; total: number }>`
  - `getReceiptDb(id: string): Promise<Record<string, unknown> | undefined>`
  - `applyFlowActionDb(id: string, action: "submit" | "return" | "withdraw", operator: string, reason?: string): Promise<{ id: string; ok: true; flowStatus: string } | { id: string; ok: false; message: string }>`（事务：读行→算 to→update flow_status/last_submitted_by/issued_at + jsonb_set append history）
  - `putReceiptDb(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | undefined>`
  - `deleteReceiptDb(id: string): Promise<boolean>`

- [ ] **Step 1: 写失败测试（连 lab_dev，跑前须已 seed）**

```ts
// tests/api/receipts-pg.test.ts — 直调 db-queries（不经 HTTP），对 lab_dev 断言。
// 前置：npm run seed:db。pg 不可达时整组 skip（模式同 db.smoke.test.ts）。
import { describe, it, expect, beforeAll } from "vitest";
import { listReceiptsDb, getReceiptDb, applyFlowActionDb, TENANT } from "@/lib/db-queries";

const hasPg = (() => { try { require("postgres"); return true; } catch { return false; } })();

describe("receipts 三态流转（pg）", () => {
  beforeAll(function () { if (!hasPg) this.skip(); });

  it("not_yet: 停在 receiving 的单据", async () => {
    const r = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 20 });
    expect(r.total).toBeGreaterThan(0);
    for (const it of r.items) expect(it.flowStatus).toBe("receiving");
  });
  it("submitted: 已从 receiving 提交走的单据", async () => {
    const r = await listReceiptsDb({ filter: "submitted", flowStatus: "receiving", page: 1, pageSize: 20 });
    expect(r.total).toBeGreaterThan(0);
    for (const it of r.items) {
      expect(it.flowStatus).not.toBe("receiving");
      expect((it.flowHistory as any[]).some((h) => h.action === "submit" && h.from === "receiving")).toBe(true);
    }
  });
  it("flowStatus 直滤 + tenant 隔离", async () => {
    const r = await listReceiptsDb({ flowStatus: "review", page: 1, pageSize: 1000 });
    for (const it of r.items) expect(it.flowStatus).toBe("review");
  });
  it("applyFlowActionDb: submit 前进一阶并 append history", async () => {
    const list = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 1 });
    const id = String(list.items[0]!.id);
    const res = await applyFlowActionDb(id, "submit", "tester");
    expect(res.ok).toBe(true);
    const after = await getReceiptDb(id);
    expect(after!.flowStatus).toBe("task_assignment");
    expect(after!.lastSubmittedBy).toBe("tester");
    const hist = after!.flowHistory as any[];
    expect(hist[hist.length - 1]!.action).toBe("submit");
    // 还原（撤回 = 回退 + 清 lastSubmittedBy）
    await applyFlowActionDb(id, "withdraw", "tester");
  });
  it("withdraw 仅限本人", async () => {
    const list = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 1 });
    const id = String(list.items[0]!.id);
    const res = await applyFlowActionDb(id, "withdraw", "someone-else");
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/api/receipts-pg.test.ts`
Expected: FAIL（函数未导出）

- [ ] **Step 3: 实现 receipts 域（db-queries.ts 追加）**

要点（按 spec §2.4）：
- 三态用 drizzle `sql` 模板写原生条件：

```ts
import { and, eq, ne, sql as dsql, desc } from "drizzle-orm";

export async function listReceiptsDb(q: Parameters<typeof listReceiptsDb>[0]) {
  const conds = [eq(schema.sampleReceipts.tenantId, TENANT)];
  if (q.filter === "not_yet") {
    conds.push(q.flowStatus
      ? eq(schema.sampleReceipts.flowStatus, q.flowStatus as never)
      : dsql`jsonb_array_length(${schema.sampleReceipts.flowHistory}) = 0`);
  } else if (q.filter === "submitted") {
    if (q.flowStatus) {
      conds.push(ne(schema.sampleReceipts.flowStatus, q.flowStatus as never));
      conds.push(dsql`exists (select 1 from jsonb_array_elements(${schema.sampleReceipts.flowHistory}) h
        where h->>'action' = 'submit' and h->>'from' = ${q.flowStatus})`);
    } else {
      conds.push(dsql`jsonb_array_length(${schema.sampleReceipts.flowHistory}) > 0
        and ${schema.sampleReceipts.lastSubmittedBy} is not null`);
    }
  } else if (q.flowStatus) {
    conds.push(eq(schema.sampleReceipts.flowStatus, q.flowStatus as never));
  }
  if (q.contractId) conds.push(eq(schema.sampleReceipts.contractId, q.contractId));
  if (q.categoryCode) conds.push(eq(schema.sampleReceipts.categoryCode, q.categoryCode));
  if (q.lastSubmittedBy) conds.push(eq(schema.sampleReceipts.lastSubmittedBy, q.lastSubmittedBy));
  if (q.operator) conds.push(dsql`(${schema.sampleReceipts.receivedBy} = ${q.operator} or ${schema.sampleReceipts.testOperator} = ${q.operator})`);
  if (q.keyword) {
    const k = `%${q.keyword.toLowerCase()}%`;
    conds.push(dsql`(lower(${schema.sampleReceipts.commissionCode}) like ${k}
      or lower(coalesce(${schema.sampleReceipts.projectName}, '')) like ${k})`);
  }
  const rows = await db.select().from(schema.sampleReceipts)
    .where(and(...conds)).orderBy(desc(schema.sampleReceipts.commissionDate))
    .limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  const [{ n }] = await db.select({ n: dsql<number>`count(*)::int` }).from(schema.sampleReceipts).where(and(...conds));
  return { items: rows.map((r) => rowToDto(r as Record<string, unknown>)), page: q.page, pageSize: q.pageSize, total: n };
}
```

- `applyFlowActionDb` 用 `db.transaction`：`select for update` 读行 → 在 JS 里复用 FLOW_ORDER_FULL 算 to（从 api-helpers 迁入 db-queries 或 import）→ `update ... set flow_status=${to}, last_submitted_by=..., issued_at=case when..., flow_history = ${hist}::jsonb, updated_at=now` —— history 用「JS 读出→push→整列写回」最直观（append 语义 jsonb_set 也可，但整列写回与 msw 行为逐字段一致）
- withdraw 本人校验、return/withdraw 清 lastSubmittedBy 的语义照抄 api-helpers.ts `applyFlowAction`（2026-08-16 修订版）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/api/receipts-pg.test.ts`
Expected: PASS 5

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-queries.ts tests/api/receipts-pg.test.ts
git commit -m "feat(db): receipts 域查询层 — 三态流转 SQL + applyFlowActionDb 事务"
```

---

### Task 5（并入 Task 3 提交，无独立任务）——已折叠

---

### Task 6: receipts 域路由接线（5 个文件）

**Files:**
- Modify: `src/app/api/receipts/route.ts`
- Modify: `src/app/api/receipts/[id]/route.ts`
- Modify: `src/app/api/receipts/[id]/history/route.ts`
- Modify: `src/app/api/receipts/[id]/task/route.ts`
- Modify: `src/app/api/receipts/flow/route.ts`
- Modify: `src/app/api/receipts/flow/queue/route.ts`
- Modify: `src/app/api/audit-logs/route.ts`（读 sample_receipts.flow_history 派生，同一批接）

**Interfaces:**
- Consumes: Task 4 的 `listReceiptsDb/getReceiptDb/applyFlowActionDb/putReceiptDb/deleteReceiptDb`
- Produces: 同形状 HTTP 响应（REF 形状不变）

- [ ] **Step 1: 改造 receipts/route.ts（列表+新建）**

模式（GET 部分）：

```ts
import { listReceiptsDb, createReceiptDb } from "@/lib/db-queries";
import { qp, num } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const data = await listReceiptsDb({
    flowStatus: url.get("flowStatus") ?? undefined,
    contractId: url.get("contractId") ?? undefined,
    categoryCode: url.get("categoryCode") ?? undefined,
    lastSubmittedBy: url.get("lastSubmittedBy") ?? undefined,
    operator: url.get("operator") ?? undefined,
    keyword: url.get("keyword") ?? "",
    filter: url.get("filter") ?? undefined,
    page: num(url.get("page"), 1),
    pageSize: num(url.get("pageSize"), 20),
  });
  return NextResponse.json(data);
}
```

POST：body → `dtoToRow` → insert().returning() → rowToDto → 201。id 生成保留现路由的 `newId("RECEIPT-")` 模式。
错误兜底：包 try/catch，DATABASE_URL/连接错误 → `NextResponse.json({ code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" }, { status: 503 })`。

- [ ] **Step 2: 改造其余 4 个 receipts 路由 + audit-logs**

- `[id]/route.ts`：GET→getReceiptDb；PUT→putReceiptDb（`Object.assign` 语义 → dtoToRow 后 update set，id/tenantId 不可覆写）；DELETE→deleteReceiptDb
- `[id]/history/route.ts`：`(await getReceiptDb(id))?.flowHistory ?? []`
- `[id]/task/route.ts`：putReceiptDb 子集（只更新 assignee_id/assignee_name/planned_test_date + updated_at）
- `flow/route.ts`：循环 `applyFlowActionDb`（每 id 一事务），返回 `{results}` 同形状
- `flow/queue/route.ts`：listReceiptsDb({ flowStatus: stage })
- `audit-logs/route.ts`：`select id, commission_code, flow_history from sample_receipts where tenant_id=...` 后沿用现有 JS 派生逻辑（flowHistory 展开→entries），分页/过滤不变

- [ ] **Step 3: 手动冒烟（next dev + curl）**

```bash
npm run dev &
sleep 8
curl -s "http://localhost:3000/api/receipts?filter=not_yet&flowStatus=receiving&pageSize=3" | head -c 400
curl -s "http://localhost:3000/api/receipts/flow/queue?stage=review&pageSize=2" | head -c 300
```

Expected: JSON 含 db 数据（commissionCode 前缀 RECEIPT-FM- 的派生单据可见）

- [ ] **Step 4: typecheck + 全量测试**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 type 错；既有测试全绿（msw 模式测试不受影响——fixtures 路径只在 nextjs 模式路由里被替换，组件测试走 MSW 拦截）

- [ ] **Step 5: Commit**

```bash
git add src/app/api/receipts/ src/app/api/audit-logs/
git commit -m "feat(api): receipts 域 5 路由 + audit-logs 接 lab_dev（三态流转 SQL）"
```

---

### Task 7: contracts/samples/test-records 域路由接线

**Files:**
- Modify: `src/lib/db-queries.ts`（追加三域 CRUD 函数）
- Modify: `src/app/api/contracts/route.ts`、`src/app/api/contracts/[id]/route.ts`
- Modify: `src/app/api/samples/route.ts`、`src/app/api/samples/[id]/route.ts`
- Modify: `src/app/api/test-records/route.ts`、`src/app/api/test-records/[id]/route.ts`、`src/app/api/test-records/[id]/verdict/route.ts`
- Modify: `src/app/api/summary/route.ts`、`src/app/api/summary/stats/route.ts`（读 receipts/samples/contracts 计数）

**Interfaces:**
- Consumes: Task 2 映射器、`db/schema`
- Produces: `listContractsDb/createContractDb/getContractDb/putContractDb/deleteContractDb`、samples 同款五件套、`patchVerdictDb(id, verdict)`、`summaryDb(categoryCode)`、`summaryStatsDb()`

- [ ] **Step 1: db-queries 追加三域函数**

照 Task 4 模式：每域 list（过滤条件照抄现路由：contracts 的 status/keyword、samples 的 receiptId 等）+ create/put/delete。写法与 Task 4 同构——**读现路由源码逐参数对齐**，不新增语义。

- [ ] **Step 2: 改 7 个路由文件**

逐个替换 fixtures import → db-queries 调用；响应形状不变（summary 的 columns/rows、stats 的 reportCountByStatus 键名逐字保留）。

- [ ] **Step 3: 冒烟**

```bash
curl -s "http://localhost:3000/api/contracts?pageSize=2" | head -c 300
curl -s -X POST "http://localhost:3000/api/contracts" -H "content-type: application/json" -d '{"contractCode":"PG-TEST-001","projectName":"pg 接线验证","clientUnit":"测试","status":"active"}' | head -c 300
curl -s "http://localhost:3000/api/summary/stats" | head -c 300
```

Expected: 201 后 psql `select count(*) from contracts where contract_code='PG-TEST-001'` = 1；stats 数字 = db 实况

- [ ] **Step 4: typecheck + vitest 全绿 → Commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/lib/db-queries.ts src/app/api/contracts/ src/app/api/samples/ src/app/api/test-records/ src/app/api/summary/
git commit -m "feat(api): contracts/samples/test-records/summary 四域接 lab_dev"
```

---

### Task 8: catalog 4 码表 + technical-requirements/calculation-rules 接线

**Files:**
- Modify: `src/lib/db-queries.ts`（追加 catalogGeneric）
- Modify: `src/lib/catalog-handlers.ts`（数组参数 → 表名参数）
- Modify: `src/app/api/catalog/{brands,models,specs,grades}/route.ts` + 4 个 `[code]/route.ts`（8 文件）
- Modify: `src/app/api/technical-requirements/route.ts` + `[id]/route.ts`
- Modify: `src/app/api/calculation-rules/route.ts` + `[id]/route.ts`

**Interfaces:**
- Produces: `catalogDb(table: "inspection_brands"|"inspection_models"|"inspection_specs"|"inspection_grades", ...)` 泛型 CRUD——4 张码表 DDL 同构（code PK/inspection_object_code/name/sort_order/tenant_id），一个函数服务 8 路由
- Produces: `dictCrudDb(table)`（technical-requirements/calculation-rules 共用：list 带 keyword + create/put/delete）

- [ ] **Step 1: catalog-handlers.ts 改签名**

`catalogGet(arr, req)` → `catalogGetDb(tableName, req)`；内部 `db.select().from(sql identifier)` 或 switch 四表（drizzle typed 表对象 switch 更安全，推荐 switch：`const T = { inspection_brands: schema.inspectionBrands, ... }`）。PUT/DELETE 的 code 命中 + inspectionObjectCode 过滤逻辑照抄。

- [ ] **Step 2: 改 8+4 个路由文件**（机械替换，每个文件 diffs ≤ 15 行）

- [ ] **Step 3: 冒烟 + typecheck + vitest → Commit**

```bash
curl -s "http://localhost:3000/api/catalog/brands?inspectionObjectCode=cement&pageSize=3" | head -c 300
curl -s "http://localhost:3000/api/technical-requirements?pageSize=2" | head -c 300
git add src/lib/ src/app/api/catalog/ src/app/api/technical-requirements/ src/app/api/calculation-rules/
git commit -m "feat(api): catalog 4 码表 + 技术要求/计算规则接 lab_dev"
```

---

### Task 9: M06 inspection 主表 + junction links 接线（最大批量）

**Files:**
- Modify: `src/lib/db-queries.ts`（追加 `wrapDictDb` + links CRUD）
- Modify: `src/lib/api-helpers.ts`（`wrapDict/wrapLinks/linkDelete` 保留给…—— 不，直接改这三个函数的调用面：详见 Step 1）
- Modify: 8 个主表路由：`inspection/{specialties,objects,parameters,standards}/route.ts` + 4 个 `[code]/route.ts`
- Modify: `inspection/objects/[code]/route.ts` 等详情路由
- Modify: 4 个 `inspection/links/*/route.ts`
- Modify: 4 个 `report-names/*` 路由
- Modify: 3 个 `inspection-param-interfaces/*` 路由

**Interfaces:**
- Produces: `wrapDictDb(tableName, req, junctions)` —— 语义 = 现 `wrapDict`（keyword/4 个 reverse 键过滤 + aggregate 聚合列 + 分页），但 rows 从 db 拉。junction 聚合仍在 JS 做（junction 表整表 select 后内存 join，量级 ≤ 880 行可接受；SQL 下推是后续优化不做）
- Produces: `wrapLinksDb(tableName, req, filterKeys)`、`linkPostDb(tableName, body)`、`linkDeleteDb(tableName, req)` —— 语义照抄 wrapLinks/linkDelete

- [ ] **Step 1: wrapDictDb 实现**

策略：**保留 api-helpers.ts 的 wrapDict 纯函数原样**，在 db-queries 里只做「从 db 拉行 → 调 wrapDict」。即：

```ts
import { wrapDict } from "./api-helpers";
export async function wrapDictDb(table: keyof typeof schema, req: Request, junctions?: DictJunctions) {
  const t = schema[table] as never;
  const rows = (await db.select().from(t)) as Record<string, unknown>[];
  return wrapDict(rows.map(rowToDto), req, junctions);
}
```

junction 的 link 数组同样从对应表 select（route 文件里传 junctions 时改为传 db 行——各 route 的 junctions 定义处把 fixtures import 换成 `await selectLinkTable(...)` 辅助函数）。

- [ ] **Step 2: 改 8 个主表路由**（GET 走 wrapDictDb；POST/PUT/DELETE 走 dictCrudDb 同款 SQL，isOfficial 拒删 → `delete ... where code=$1 and is_official=false` 0 行→404/400 按 REF 语义）

- [ ] **Step 3: 改 4 links + 4 report-names + 3 param-interfaces 路由**（wrapLinksDb/linkPostDb/linkDeleteDb；param-interface DELETE isOfficial 400 语义保留）

- [ ] **Step 4: 冒烟（聚合列 + junction 过滤是回归高危区）**

```bash
curl -s "http://localhost:3000/api/inspection/objects?keyword=&pageSize=2" | head -c 500   # parameterNames 聚合列在
curl -s "http://localhost:3000/api/inspection/objects?inspectionSpecialtyCode=<某码>&pageSize=3" | head -c 400
curl -s "http://localhost:3000/api/inspection/links/standard-parameter?standardCode=<某码>" | head -c 300
curl -s "http://localhost:3000/api/report-names?pageSize=2" | head -c 400
```

与 msw 模式同参数响应比对（data 一致即语义没漂）

- [ ] **Step 5: typecheck + vitest → Commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/lib/ src/app/api/inspection/ src/app/api/report-names/ src/app/api/inspection-param-interfaces/
git commit -m "feat(api): M06 主表+junction+报告名称+参数界面 19 路由接 lab_dev"
```

---

### Task 10: 清理 api-helpers fixtures 面 + 503 兜底统一

**Files:**
- Modify: `src/lib/api-helpers.ts`（删 fixtures import 与 re-export；`applyFlowAction/findReceipt` 若已无消费者则删；`wrapDict/wrapLinks/linkDelete` 保留——Task 9 还在用）
- Modify: `src/lib/db-queries.ts`（统一 `withDb(handler)` 包装：try/catch → 503 DB_UNAVAILABLE）

**Interfaces:**
- Produces: `withDb<T>(fn: () => Promise<T>): Promise<T | NextResponse>` —— 所有路由 GET/POST 外层包装（Task 6-9 各路由手工 try/catch 可在此统一替换）

- [ ] **Step 1: 验证 fixtures 只剩 0 引用**

```bash
grep -rln "management-system-msw/fixtures" src/app/api/ | wc -l   # Expected: 0
```

（`src/lib/`、`src/components/`、`src/api/` 可能仍有 fixtures import——**只清 src/app/api/**，前端 store 层不动）

- [ ] **Step 2: withDb 统一 503 兜底并替换各路由手工 try/catch**

- [ ] **Step 3: typecheck + vitest + grep 双确认 → Commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/lib/
git commit -m "refactor(api): api-helpers 去 fixtures 化 + withDb 统一 503 兜底"
```

---

### Task 11: 集成测试（pg-crud）+ 门禁全绿

**Files:**
- Test: `tests/api/pg-crud.dom.test.tsx`（走 axios 直调 route handler 导出——m98-wiring 同款模式 import { GET } from route）

**Interfaces:**
- Consumes: Task 6-9 改完的路由导出
- Produces: L4 可追溯的端到端证据

- [ ] **Step 1: 写集成测试**

```ts
// tests/api/pg-crud.dom.test.tsx — nextjs 模式端到端：route handler → lab_dev 落库回读。
// 前置：npm run seed:db；pg 不可达 skip。
import { describe, it, expect, beforeAll } from "vitest";
import { GET as cGET, POST as cPOST } from "@/app/api/contracts/route";
import { DELETE as cDELETE } from "@/app/api/contracts/[id]/route";
import { GET as rGET } from "@/app/api/receipts/route";
import { fnTest } from "../fn";

function req(url: string, init?: RequestInit) { return new Request(`http://localhost${url}`, init); }

describe("pg CRUD 端到端", () => {
  beforeAll(function () { /* pg 可达性探测，不可达 skip */ });

  fnTest(["M98.F03.I02"], "contracts POST→GET→DELETE 落库往返", async () => {
    const post = await cPOST(req("/api/contracts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractCode: "PG-E2E-001", projectName: "e2e", clientUnit: "e2e", status: "active" }),
    }) as never);
    expect(post.status).toBe(201);
    const list = await cGET(req("/api/contracts?keyword=PG-E2E-001") ) as never;
    // ...status 200 + items 含 PG-E2E-001 → DELETE → 再 GET 0 条
  });

  fnTest(["M03.F01"], "receipts 三态列表命中 db（RECEIPT-FM- 派生单据可见）", async () => {
    const res = await rGET(req("/api/receipts?pageSize=50")) as never;
    expect(res.status).toBe(200);
    // items 含 RECEIPT-FM- 前缀 id（flow-matrix 派生只有 db/seed 链路能出）
  });
});
```

fnTest 挂既有 ID（M98.F03.I02 / M03.F01 等），**不加新 ID**（新 ID 属 tree-change 范畴，Task 13 处理）。

- [ ] **Step 2: seed 重置 + 全量测试**

```bash
npm run seed:db && npx vitest run
```

Expected: 全绿含新集成测试

- [ ] **Step 3: 门禁**

```bash
cd ../.. && python scripts/gate.py -p lab-management-system-nextjs
```

Expected: exit 0（L0-L5 全绿 0 软告警）

- [ ] **Step 4: Commit**

```bash
git add tests/api/pg-crud.dom.test.tsx
git commit -m "test(api): pg CRUD 端到端集成测试（route handler → lab_dev 往返）"
```

---

### Task 12: ADR + CLAUDE.md 更新

**Files:**
- Create: `docs/adr/0001-nextjs-api-pg-data-layer.md`（仓内首份 ADR，编号从 0001）
- Modify: `CLAUDE.md`（§1 后端描述 + §3 红线）

**Interfaces:** 无代码接口

- [ ] **Step 1: 写 ADR**（决策：postgres-js runtime 对齐 saas；pg 走传递依赖服务借链；无条件接库无双源开关；JS 内存 junction join 的取舍）

- [ ] **Step 2: 改 CLAUDE.md**

- §1 第 2 点：「业务路由数据来自 `@lab/management-system-msw/fixtures`（in-memory）」→「业务路由读写 lab_dev（postgres-js + drizzle，`src/db/` + `src/lib/db-queries.ts`）；种子 `npm run seed:db`（灌 msw 同源种子）」
- §3 红线「禁 `pg` 升 dependencies」→「禁在 dependencies 里加 `pg`（借链走 drizzle-orm 传递依赖；runtime 数据层统一 postgres-js——ADR 0001）」

- [ ] **Step 3: 收尾验证借链**

```bash
node ../lab-management-system-shared/scripts/sync-db.mjs --incremental
```

Expected: 正常跑完（0 个新 V 或只记录已有；**绝不能 FATAL 借不到 pg**）。若 FATAL：恢复 package.json devDependencies `pg: ^8.13.1`，CLAUDE.md 红线保持原表述，ADR 记录实际采用的布局。

- [ ] **Step 4: Commit**

```bash
git add docs/adr/ CLAUDE.md
git commit -m "docs: ADR 0001 pg 数据层 + CLAUDE.md 后端角色/红线更新"
```

---

### Task 13: tree-change 提案（M98 pg 数据层子项）

**Files:**
- `.state/tree-change.json`（走 `/tree-change` skill 流程）
- `docs/functions/function-tree.md`（批准后改）

**Interfaces:** 无代码接口

- [ ] **Step 1: 用 /tree-change skill 提案**：M98 加 F04「pg 数据层（lab_dev 读写）」+ I 级子项（seed 脚本 / db 单例 / receipts 三态 SQL / 42 路由接线 / 集成测试），状态 已上线（代码已落）
- [ ] **Step 2: 人批后改 function-tree.md + design-function-map.md 补映射行**
- [ ] **Step 3: 重跑门禁确认 0 软告警**

```bash
cd ../.. && python scripts/gate.py -p lab-management-system-nextjs
```

- [ ] **Step 4: Commit（tree 收口）+ push**

```bash
git add .state/ docs/functions/
git commit -m "feat(tree): M98.F04 pg 数据层子项收口"
git push origin master
```

---

## 执行顺序与依赖

```text
Task 1 (deps+db 单例)
  → Task 2 (映射器)
    → Task 3 (seed) ──→ Task 4 (receipts SQL) ──→ Task 6 (receipts 路由) ─┐
                                            └──→ Task 7 (contracts等)  ──┤
                                                 Task 8 (catalog)      ──┤
                                                 Task 9 (M06 大批量)   ──┤
                                                                        Task 10 (清理)
                                                                        Task 11 (集成+门禁)
                                                                        Task 12 (ADR+CLAUDE.md)
                                                                        Task 13 (tree-change)
```

Task 7/8/9 相互独立可并行（都只依赖 Task 1+2+3 的产物）。
