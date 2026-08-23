# lab-management-system-nextjs 全量功能补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lab-nextjs 前端达到与 `backup/lab-management-system`（REF）的 UI/功能对等——13 个 feature 域全落地，数据走 lab-msw，L0–L5 全绿 0 软告警。

**Architecture:** REF 组件 + zustand store 忠实移植为 Next.js App Router client pages；数据层通过本仓 `http-client` 适配（baseURL 由 backend-switcher 决定，默认 msw）；REF 的旧路由名映射到当前 lab-msw 的 OpenAPI v2 路由；docx 模板经 `public/templates/` + 静态 manifest 索引加载。

**Tech Stack:** Next.js 15 App Router / React 19 / zustand 5 / axios / docxtemplater + pizzip + docx-preview / msw 2 (dev+test) / vitest 4 + testing-library。

**Spec:** `docs/superpowers/specs/2026-08-14-full-feature-parity-design.md`（本计划从 spec 出发，执行者两份都读）

## Global Constraints

- npm 依赖一律 `--registry=https://registry.npmmirror.com`
- 禁手写 `.state/trace.json`（fnReporter 产出）；禁给 skip 测试挂 ID
- 功能树状态推进必须走 `python scripts/tree_change.py -p lab-management-system-nextjs --report/--approve`（人工批准，不可 echo y）
- `generated/` 与 `src/api/endpoints/` 是 gitignored 产物，禁手改
- 每个任务结束跑 `npx tsc --noEmit`；每波结束跑 `python scripts/gate.py -p lab-management-system-nextjs`，exit 0 才进下一波
- 移植时 `data-fn` 属性与 `@entry` 注释原样保留（L5 校验锚点）
- REF 源路径 = `d:/zcqiand-life/1-projects/xr-code-suite/backup/lab-management-system/`（下文记 `$REF`）；本仓 = `output/lab-management-system-nextjs/`
- 禁止把 `tests/server-only.stub.ts` 别名移除；vitest 环境改动只许按 Task 2 的方式加

## 关键映射表（全计划共用）

### M1 路由映射（REF 旧路由 → lab-msw 当前路由）

| REF 调用 | lab-msw 路由 | 说明 |
| --- | --- | --- |
| GET `/audit-logs` | （msw 缺失） | Task 12 在 msw 仓补 handler，或页面降级空列表 |
| GET/POST `/inspection-calculation-rules` | `/calculation-rules`（复合主键 objectCode+parameterCode） | 改路径 + 参数名核对 |
| GET `/inspection-parameter-param-interfaces?paramCode=` | GET `/param-interfaces/links?parameterCode=` | msw 已有 POST/DELETE，GET links 需核对（Task 3 冒烟） |
| GET `/inspection-report-name-parameters?reportNameCode=` | GET `/report-names/links/parameter?reportNameCode=` | 同 |
| GET `/inspection-report-name-standards?reportNameCode=` | GET `/report-names/links/standard?reportNameCode=` | 同 |
| GET `/inspection-standard-parameters?standardCode=` | GET `/inspection/links/standard-parameter?standardCode=` | 同 |
| GET `/inspection-objects/-parameters/-standards/-technical-requirements` | `/inspection/objects`、`/inspection/parameters`、`/inspection/standards`、`/technical-requirements` | 去掉 `inspection-` 前缀 |
| GET `/param-interfaces` | `/param-interfaces` | 不变 |
| GET `/report-names` | `/report-names` | 不变 |
| identityClient `/auth/login`、`/auth/oauth/callback`、`/auth/permissions`、`/auth/menus` | msw `/auth/*` 已有同名 | 不变（identityClient baseURL 默认 `/api`） |

### M2 env 映射（REF → Next.js）

| REF `import.meta.env` | Next.js `process.env` |
| --- | --- |
| `VITE_API_BASE_URL` | ~~删除~~ 2026-08-20 增注：baseURL 改走 `NEXT_PUBLIC_API_BASE_URL`（ADR-0014）；原行描述"backend-context"已废弃 |
| `VITE_IDENTITY_BASE_URL` | `NEXT_PUBLIC_IDENTITY_BASE_URL` |
| `VITE_APP_ID` | `NEXT_PUBLIC_APP_ID` |
| `VITE_SSO_AUTHORIZE_URL` | `NEXT_PUBLIC_SSO_AUTHORIZE_URL` |
| `VITE_OAUTH_SCOPES` | `NEXT_PUBLIC_OAUTH_SCOPES` |
| (新增 ADR-0014) | `NEXT_PUBLIC_ENABLE_MSW`（默认 dev=true / prod=false）；`NEXT_PUBLIC_API_MODE`（默认 "msw"，仅 UI 显示） |
| `VITE_USE_MSW` | `NEXT_PUBLIC_USE_MSW`（默认 true） |

### M3 数据文件映射

- REF `src/data/generated/*.json`（19 个）→ 本仓 `src/data/generated/`，从 **lab-msw `src/seeds/*.json`** 拷贝（不是从 backup shared 拷——msw 25 表 > backup 21，是更新的真相源）。名字对齐 REF 引用名：`param-interface-link.json` → `inspection-parameter-param-interface.json`；`sample-receipts.json`/`samples.json`/`test-records.json`/`contracts.json`/`tenants.json` REF 不直接 import，不拷。
- REF `data/templates/*.docx`（30 个）→ 本仓 `public/templates/`（浏览器按 URL fetch）
- REF `data/templates/*.inject.json`（29 个）→ 本仓 `src/data/templates/` + Task 4 生成的静态索引 `src/data/templates/manifests.ts`

---

## Wave 1 基建

### Task 1: 依赖安装 + tsc 基线

**Files:**
- Modify: `package.json`（依赖增量）

**Interfaces:**
- Produces: 后续所有任务可 import `zustand` / `docxtemplater` / `pizzip` / `docx-preview` / `@testing-library/react` / `jsdom` / `msw`

- [ ] **Step 1: 安装依赖**

```bash
cd output/lab-management-system-nextjs
npm install zustand@^5.0.2 docx-preview@^0.4.0 docxtemplater@^3.69.3 pizzip@^3.2.0 --registry=https://registry.npmmirror.com
npm install -D @testing-library/react@^16.1.0 @testing-library/jest-dom@^6.6.3 @testing-library/user-event@^14.5.0 jsdom@^25.0.1 msw@^2.14.6 --registry=https://registry.npmmirror.com
```

（不装 `@dnd-kit/*`——grep REF 源码确认 dnd-kit 只在 REF devDeps，features/ 无 import；若 Wave 2 移植时发现某组件 import 再补）

- [ ] **Step 2: 验证类型基线**

Run: `npx tsc --noEmit`
Expected: 0 errors（新依赖只是装上，还没代码引用）

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(nextjs): 加业务功能依赖 zustand/docx 三件套/testing-library/jsdom/msw"
```

### Task 2: vitest 双环境（node + jsdom）

**Files:**
- Modify: `vitest.config.ts`
- Modify: `tests/setup.ts`（改为按环境分流）
- Create: `tests/setup.dom.ts`

**Interfaces:**
- Produces: `tests/**/*.dom.test.tsx` 跑 jsdom + RTL + msw node server；其余维持 node 环境。测试文件命名约定：组件/页面测试一律 `*.dom.test.tsx`

- [ ] **Step 1: 改 vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import FnReporter from "./tests/fnReporter";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["**/*.dom.test.tsx", "jsdom"],
      ["**/*.dom.test.ts", "jsdom"],
    ],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".next", "src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: byEnv(),
    reporters: ["default", new FnReporter()],
    env: { DB_PATH: ":memory:" },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": fileURLToPath(new URL("./tests/server-only.stub.ts", import.meta.url)),
    },
  },
});

// jsdom 测试拿 setup.dom.ts（RTL 清理 + msw server），node 测试拿原 setup.ts
function byEnv(): string[] {
  return ["tests/setup.ts", "tests/setup.dom.ts"];
}
```

注意：`setup.dom.ts` 内部必须先判 `typeof window !== "undefined"` 才装 jsdom 专属逻辑——node 环境测试也会执行该 setup 文件。

- [ ] **Step 2: 写 tests/setup.dom.ts**

```ts
// jsdom 环境专属 setup：RTL 清理 + msw node server 生命周期。
// vitest environmentMatchGlobs 命中 jsdom 的测试才会真正用到这里的 window。
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

const dom = typeof window !== "undefined";
let server: { listen:unknown; close:unknown; resetHandlers:unknown; restoreHandlers:unknown } | null = null;

if (dom) {
  beforeAll(async () => {
    const { setupNodeMocks } = await import("@lab/management-system-msw/node");
    const s = setupNodeMocks() as unknown as typeof server & { listen:any; close:any; resetHandlers:any };
    server = s;
    s.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server?.resetHandlers();
    localStorage.clear();
    cleanup();
  });
  afterAll(() => {
    (server as any)?.close();
  });
}
```

（`@lab/management-system-msw` 已是本仓 devDep，Task 1 又装了 `msw`——`msw/node` 从本仓解析，与 msw 仓同 major v2）

- [ ] **Step 3: 冒烟验证**

临时建 `tests/_env.dom.test.tsx`：

```tsx
import { expect, test } from "vitest";
test("jsdom environment active", () => {
  expect(typeof window).toBe("object");
  expect(typeof document).toBe("object");
});
```

Run: `npm test`
Expected: db.smoke 4 pass + _env 1 pass

删除临时文件，保留 `*.dom.test.tsx` 命名约定。Commit：

```bash
git add vitest.config.ts tests/setup.ts tests/setup.dom.ts
git commit -m "test(nextjs): vitest 双环境 — *.dom.test.tsx 走 jsdom+RTL+msw，其余维持 node"
```

### Task 3: apiClient 适配层（含路由映射 M1）

**Files:**
- Create: `src/api/legacy-client.ts`
- Create: `src/api/env.ts`
- Test: `tests/api/legacy-client.dom.test.tsx`

**Interfaces:**
- Produces（供所有移植组件 import，路径固定 `@/api/legacy-client`）:
  - `apiClient: AxiosInstance`（baseURL 默认 `""` + msw browser 拦截；请求头自动带 `Authorization: Bearer <token>`）
  - `identityClient: AxiosInstance`（baseURL = `process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api"`）
  - `setToken(token: string | null): void`
  - `onUnauthorized(handler: () => void): void`
  - `resetApiClient(): void`
  - `API_ROUTES: Record<string, string>`——M1 映射表的代码形态，键 = REF 旧路径，值 = msw 新路径。所有移植组件只允许 `apiClient.get(API_ROUTES["/report-names"])` 形式调用

- [ ] **Step 1: 写 src/api/env.ts**

```ts
// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
export const env = {
  IDENTITY_BASE_URL: process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api",
  APP_ID: process.env.NEXT_PUBLIC_APP_ID || "lab-management",
  SSO_AUTHORIZE_URL: process.env.NEXT_PUBLIC_SSO_AUTHORIZE_URL || "/sso/authorize",
  OAUTH_SCOPES: process.env.NEXT_PUBLIC_OAUTH_SCOPES || "",
  USE_MSW: process.env.NEXT_PUBLIC_USE_MSW !== "false",
} as const;
```

- [ ] **Step 2: 写 src/api/legacy-client.ts**

```ts
"use client";
// REF api/client.ts 的移植形态：组件代码 import 这里，签名与 REF src/api/client.ts 一致。
// 路由经 API_ROUTES 映射到 lab-msw 当前 OpenAPI 路由（见计划 M1 表）。
import axios, { type AxiosInstance } from "axios";
import { getApiBaseUrl } from "./backend-config";  // ADR-0014：旧 getBaseUrl() 已废弃
import { env } from "./env";

let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setToken(token: string | null) { currentToken = token; }
export function onUnauthorized(handler: () => void) { unauthorizedHandler = handler; }
export function resetApiClient() { currentToken = null; unauthorizedHandler = null; }

export const apiClient: AxiosInstance = axios.create({ baseURL: "" });
export const identityClient: AxiosInstance = axios.create({ baseURL: env.IDENTITY_BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (!config.baseURL) config.baseURL = getBaseUrl() || "";
  if (currentToken) config.headers.set("Authorization", `Bearer ${currentToken}`);
  return config;
});
identityClient.interceptors.request.use((config) => {
  if (currentToken) config.headers.set("Authorization", `Bearer ${currentToken}`);
  return config;
});
for (const client of [apiClient, identityClient]) {
  client.interceptors.response.use(
    (r) => r,
    (err: { response?: { status?: number } }) => {
      if (err.response?.status === 401) unauthorizedHandler?.();
      return Promise.reject(err);
    },
  );
}

/** REF 旧路由 → lab-msw OpenAPI v2 路由。键以 REF 源码出现过的字面量为准。 */
export const API_ROUTES = {
  "/audit-logs": "/audit-logs",
  "/auth/login": "/auth/login",
  "/auth/oauth/callback": "/auth/sso/callback",
  "/auth/permissions": "/auth/permissions",
  "/auth/menus": "/auth/menus",
  "/contracts": "/contracts",
  "/inspection-calculation-rules": "/calculation-rules",
  "/inspection-objects": "/inspection/objects",
  "/inspection-parameters": "/inspection/parameters",
  "/inspection-parameter-param-interfaces": "/param-interfaces/links",
  "/inspection-report-name-parameters": "/report-names/links/parameter",
  "/inspection-report-name-standards": "/report-names/links/standard",
  "/inspection-standard-parameters": "/inspection/links/standard-parameter",
  "/inspection-standards": "/inspection/standards",
  "/inspection-technical-requirements": "/technical-requirements",
  "/param-interfaces": "/param-interfaces",
  "/receipts": "/receipts",
  "/receipts/flow": "/receipts/flow",
  "/report-names": "/report-names",
  "/samples": "/samples",
  "/summary": "/summary",
  "/test-records": "/test-records",
} as const;
```

- [ ] **Step 3: 冒烟测试（同时验证 6 条 link 路由在 msw 真的可达）**

`tests/api/legacy-client.dom.test.tsx`：

```tsx
import { expect, test } from "vitest";
import { apiClient, API_ROUTES } from "@/api/legacy-client";

// REF UI 依赖的 link/列表端点在 lab-msw 全部可达（M1 映射的集成冒烟）。
// 失败 = msw 仓缺 handler，先修 msw 再继续移植。
test("API_ROUTES 映射的端点全部可达", async () => {
  const gets = [
    "/inspection-calculation-rules", "/inspection-objects", "/inspection-parameters",
    "/inspection-standards", "/inspection-technical-requirements", "/param-interfaces",
    "/report-names", "/receipts", "/samples", "/test-records", "/summary",
    "/inspection-parameter-param-interfaces", "/inspection-report-name-parameters",
    "/inspection-report-name-standards", "/inspection-standard-parameters",
  ] as const;
  for (const legacy of gets) {
    const res = await apiClient.get(API_ROUTES[legacy]);
    expect(res.status).toBe(200);
  }
});
```

Run: `npx vitest run tests/api/legacy-client.dom.test.tsx`
Expected: PASS。若 `/param-interfaces/links` 等 GET 404 → 停下，在 msw 仓补 GET handler（`src/handlers-extra.ts` 847 行附近已有 POST/DELETE），msw 仓 commit 后重跑。

- [ ] **Step 4: tsc + Commit**

```bash
npx tsc --noEmit
git add src/api/legacy-client.ts src/api/env.ts tests/api/legacy-client.dom.test.tsx
git commit -m "feat(nextjs): REF apiClient 适配层 — setToken/onUnauthorized 签名保持 + API_ROUTES 旧→新路由映射 + msw 集成冒烟"
```

### Task 4: 数据文件落位（generated JSON + docx 模板 + manifest 索引）

**Files:**
- Create: `src/data/generated/*.json`（19 个，来自 lab-msw seeds）
- Create: `public/templates/*.docx`（30 个）
- Create: `src/data/templates/*.inject.json`（29 个）
- Create: `scripts/gen-template-index.mjs`
- Create: `src/data/templates/manifests.ts`（生成产物，**入仓**——Next build 不跑脚本）

**Interfaces:**
- Produces: `import { MANIFEST_BY_BASENAME } from "@/data/templates/manifests"` → `Record<string, GridManifest>`（`GridManifest` 类型定义在 `src/features/data-entry/reportTemplateData.ts`，形状 = REF reportTemplateData.ts:405-412）
- Produces: 模板 URL = `"/templates/" + encodeURIComponent(basename) + ".docx"`（public 目录直出）

- [ ] **Step 1: 拷贝（PowerShell）**

```powershell
$msw = "d:/zcqiand-life/1-projects/xr-code-suite/output/lab-management-system-msw"
New-Item -ItemType Directory -Force src/data/generated, src/data/templates, public/templates | Out-Null
Copy-Item "$msw/src/seeds/inspection-*.json" src/data/generated/
Copy-Item "$msw/src/seeds/param-interface.json" src/data/generated/
Copy-Item "$msw/src/seeds/param-interface-link.json" src/data/generated/inspection-parameter-param-interface.json
Get-ChildItem "$msw/src/templates/*.docx" | Copy-Item -Destination public/templates/
Get-ChildItem "$msw/src/templates/*.inject.json" | Copy-Item -Destination src/data/templates/
```

- [ ] **Step 2: 写 scripts/gen-template-index.mjs**

```js
#!/usr/bin/env node
// 读 src/data/templates/*.inject.json → 生成静态索引 src/data/templates/manifests.ts。
// Next/webpack 没有 import.meta.glob；把每个 manifest 内联成对象字面量是等价物
// （键含中文，不能做 import identifier，故内联而非 import）。
// drift 由 Task 10 测试的 manifest 数量断言兜底。
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "templates");
const files = readdirSync(dir).filter((f) => f.endsWith(".inject.json")).sort();

const entries = files.map((f) => {
  const base = f.replace(/\.inject\.json$/, "");
  const json = readFileSync(join(dir, f), "utf8").trimEnd();
  return `  ${JSON.stringify(base)}: ${json},`;
});
const out = [
  "// GENERATED by scripts/gen-template-index.mjs — do not edit.",
  "// basename → inject manifest（等价 REF reportTemplateData.ts 的 import.meta.glob eager）。",
  "export const MANIFEST_BY_BASENAME: Record<string, unknown> = {",
  ...entries,
  "};",
  "",
].join("\n");
writeFileSync(join(dir, "manifests.ts"), out);
console.log(`manifests.ts: ${files.length} manifests`);
```

- [ ] **Step 3: 生成 + 校验 drift**

Run: `node scripts/gen-template-index.mjs && npx tsc --noEmit`
Expected: 输出 `manifests.ts: 29 manifests`（108_砂浆 无 sidecar，与 REF 故意 parity），tsc 0 error

- [ ] **Step 4: Commit**

```bash
git add src/data public/templates scripts/gen-template-index.mjs
git commit -m "feat(nextjs): 数据文件落位 — 19 generated JSON(自 msw seeds) + 30 docx public + 29 inject manifest 静态索引"
```

### Task 5: types + 纯逻辑 store 移植

**Files:**
- Create: `src/types/**`（REF `src/types/` 整目录 31 文件，仅 2 处机械改：`src/types/api.ts` 的 import 路径）
- Create: `src/state/{authStore,receiptStore,sampleStore,contractStore,auditStore,flowStore,flowReducer,transitions}.ts`（REF 对应 store 文件）
- Test: `tests/types/store.test.ts`、`tests/types/inspection.test.ts`（从 REF 对应文件拷，fnTest ID 保留）

**Interfaces:**
- Produces: `useAuthStore` / `useReceiptStore` / `useSampleStore` / `useContractStore` / `useAuditStore` / `useFlowStore`（zustand hooks，签名 = REF 同名）
- 移植规则（每个文件执行）：
  1. `'../../api/client'` → `'@/api/legacy-client'`
  2. `'../../types/x'` → `'@/types/x'`
  3. `import.meta.env.*` → `env.*`（from `@/api/env`，按 M2 表）
  4. 相对路径 import 一律改 `@/` 别名
  5. 其余逐字保留（含注释、data-fn、`@entry`）

- [ ] **Step 1: 拷 types**

REF `src/types/` → 本仓 `src/types/`（注意本仓 `src/types` 目录当前不存在，无覆盖风险）。`react-dom.d.ts` 不拷（Vite 专属）。

- [ ] **Step 2: 拷 store + flow 纯逻辑**

| REF 文件 | 本仓目标 |
| --- | --- |
| `src/features/auth/authStore.ts` | `src/state/authStore.ts` |
| `src/features/receipts/receiptStore.ts` | `src/state/receiptStore.ts` |
| `src/features/samples/sampleStore.ts` | `src/state/sampleStore.ts` |
| `src/features/contracts/contractStore.ts` | `src/state/contractStore.ts` |
| `src/features/audit/auditStore.ts` | `src/state/auditStore.ts` |
| `src/features/flow/flowStore.ts` | `src/state/flowStore.ts` |
| `src/features/flow/flowReducer.ts` | `src/state/flowReducer.ts` |
| `src/features/flow/transitions.ts` | `src/state/transitions.ts` |
| `src/features/flow/types.ts` | `src/state/flow-types.ts`（避免与 `@/types` 混淆） |

按移植规则 5 条改 import。`authStore.ts` 里的 `identityClient.post('/auth/login')` 改 `identityClient.post(API_ROUTES['/auth/login'])`。

- [ ] **Step 3: 拷 2 个 types 测试 + 跑**

REF `tests/types/{store,inspection}.test.ts` → 本仓 `tests/types/`（node 环境即可，不加 .dom）。若有 fnTest ID 保留。

Run: `npx vitest run tests/types/`
Expected: PASS

- [ ] **Step 4: tsc + Commit**

```bash
npx tsc --noEmit
git add src/types src/state tests/types
git commit -m "feat(nextjs): types 31 文件 + 6 zustand store + flow 纯逻辑移植（import 改 @/ 别名 + legacy-client）"
```

### Task 6: 功能树镜像（tree-change 提案）

**Files:**
- Modify: `docs/functions/function-tree.md`（经 tree_change.py 流程改）

**Interfaces:**
- Produces: 功能树 = REF 194 行（M00–M06 全量 I 级）+ 本仓 M97/M98 保留段；新镜像行初始状态「规划」

- [ ] **Step 1: 构造提案文件**

tree-change 走 `python scripts/tree_change.py -p lab-management-system-nextjs --template` 拿模板，把 REF `docs/functions/function-tree.md` 的 M00–M06 段（模块总览 + BASE F 级 + 全部 I 级子项）并入本仓树（替换现有 26 行 BASE F 级段；M97/M98 段原样保留）。状态列：REF 已上线的行在本仓初始写「规划」（落地后逐波推），已废弃行照抄「已废弃」。

- [ ] **Step 2: 提交提案 + 人工批准**

```bash
python scripts/tree_change.py -p lab-management-system-nextjs --report
python scripts/tree_change.py -p lab-management-system-nextjs --approve   # 等用户确认后执行
```

- [ ] **Step 3: 预检对齐**

Run: `python scripts/check_align.py --scope=lab`
Expected: 对齐通过（Next.js 计数变大但结构合法）

- [ ] **Step 4: Commit**

```bash
git add docs/functions/function-tree.md .state/
git commit -m "feat(nextjs): 功能树镜像 REF 194 行 (M00-M06 全 I 级 + 废弃行) + M97/M98 保留"
```

### Task 7: Wave 1 gate

- [ ] Run: `python scripts/gate.py -p lab-management-system-nextjs`
- [ ] Expected: exit 0（L4 应含 db.smoke + legacy-client 冒烟 + types 测试全绿）。非 0 → 按提示修，不带病进 Wave 2

---

## Wave 2 流程线 M03

> 移植规则同 Task 5 的 5 条 + 第 6 条：所有 `apiClient.xxx('/旧路径')` 的字符串字面量换成 `API_ROUTES['/旧路径']`。组件文件放 `src/features/<域>/`（与 REF 同名同结构），页面文件 `src/app/<route>/page.tsx` 只做 `"use client"` + re-export。

### Task 8: receipts + samples

**Files:**
- Create: `src/features/receipts/{ReceiptList,ReceiptFormModal,ReceiptDetail,ReceiptDetailPage,detailLabels}.tsx|ts`
- Create: `src/features/samples/{SampleList,SampleFormModal,SampleManagerModal}.tsx`
- Create: `src/app/receipts/page.tsx`、`src/app/receipts/[id]/page.tsx`
- Test: `tests/features/receipts/*.dom.test.tsx`、`tests/features/samples/*.dom.test.tsx`（REF 对应 7 个测试文件拷入，文件名加 `.dom`，fnTest ID 保留）

**Interfaces:**
- Consumes: Task 3 `apiClient/API_ROUTES`、Task 5 `useReceiptStore/useSampleStore`
- Produces: `/receipts` 列表页（三态过滤 + 新建/编辑/删除 + 详情路由）、`/receipts/[id]` 详情页（接样信息+样品+检测数据）

页面壳示例（`src/app/receipts/page.tsx`，其余页面同构）：

```tsx
"use client";
export { default } from "@/features/receipts/ReceiptListPage";
```

（若 REF `pages/Receipts.tsx` 就是该页组装层，则拷它为 `src/features/receipts/ReceiptListPage.tsx` 再 re-export——以 REF 实际结构为准，组装层也是忠实移植的一部分）

- [ ] Step 1: 拷 REF 8 个源文件按移植规则改
- [ ] Step 2: 建 2 个 page.tsx 壳
- [ ] Step 3: 拷 7 个测试改 `.dom.test.tsx`，`vi.mock` 路径同步改 `@/`
- [ ] Step 4: `npx vitest run tests/features/receipts tests/features/samples` → PASS
- [ ] Step 5: `npx tsc --noEmit` → 0 errors
- [ ] Step 6: Commit `feat(nextjs): M03.F01/F09 接样管理 + samples 移植 (7 测试)`

### Task 9: task-assignment + flow-pipeline + flow/FlowPanel

**Files:**
- Create: `src/features/task-assignment/TaskAssignmentPage.tsx`
- Create: `src/features/flow-pipeline/FlowStagePage.tsx`
- Create: `src/features/flow/FlowPanel.tsx`
- Create: `src/app/task-assignment/page.tsx`
- Test: `tests/features/task-assignment/TaskAssignmentCancel.dom.test.tsx`、`tests/features/flow-pipeline/FlowStagePage.dom.test.tsx`、`tests/integration/flowTransition.dom.test.tsx`

**Interfaces:**
- Consumes: Task 5 `useFlowStore/flowReducer/transitions`
- Produces: `/task-assignment` 页（分配/编辑/取消 + 三态过滤）、FlowStagePage（review/approve/issue/archive 4 阶段复用组件）

- [ ] Step 1-5: 同 Task 8 流程（拷 → 改 import → 壳 → 测试 → vitest/tsc → commit `feat(nextjs): M03.F02 任务分配 + flow-pipeline 通用阶段页`）

### Task 10: data-entry（13 个 model 卡片 + 模板引擎 + 2 弹窗）

**Files:**
- Create: `src/features/data-entry/`（REF 整目录 27 文件：DataEntryPage + ReportPreviewModal + SampleExtFieldsModal + models/ 16 文件 + reportTemplateData/Render/Seed 3 ts）
- Create: `src/app/data-entry/page.tsx`
- Test: REF `tests/features/data-entry/` 18 个测试文件（其中非组件的 `cementStrength`、`rebarWelding` 等纯逻辑测试不加 .dom）

**Interfaces:**
- Consumes: Task 4 `MANIFEST_BY_BASENAME` + `public/templates` URL
- 关键改写（Task 5 规则之外）：
  1. `reportTemplateData.ts:416` `import.meta.glob(...) as Record<string, GridManifest>` → `import { MANIFEST_BY_BASENAME } from "@/data/templates/manifests"`（`as unknown as Record<string, GridManifest>` 收尾）
  2. `ReportPreviewModal.tsx:9` `TEMPLATE_URLS = import.meta.glob(... ?url)` → 函数 `templateUrl(fname: string): string { return `/templates/${encodeURIComponent(fname)}` }`；`pickTemplateUrl` 改用 `REPORT_NAME_TEMPLATE[categoryCode]` 直接构 URL（去掉 TEMPLATE_URLS 查找）
  3. `reportTemplateSeed.ts:1-2` 的 `'../../data/generated/x.json'` → `'@/data/generated/x.json'`
- Produces: `/data-entry` 页（样品切换 + 参数卡片录入 + 报告预览 docx 渲染）

- [ ] Step 1: 拷 27 文件按规则改（含上面 3 处关键改写）
- [ ] Step 2: 建 page.tsx 壳
- [ ] Step 3: 拷 18 测试（.dom 判定：import RTL 的加）
- [ ] Step 4: `npx vitest run tests/features/data-entry` → PASS（这一批最长，10s testTimeout 已在 Task 2 配好）
- [ ] Step 5: tsc → commit `feat(nextjs): M03.F03 数据录入 + 13 参数卡片 + docx 报告预览引擎 (18 测试)`

### Task 11: reports 4 阶段页 + audit

**Files:**
- Create: `src/features/reports/{ReportReviewPage,ReportApprovePage,ReportIssuePage,ReportArchivePage}.tsx`
- Create: `src/features/audit/{AuditLogList,auditStore→已在Task5}.tsx`（auditStore Task 5 已进 `src/state/`，这里只拷 AuditLogList.tsx）
- Create: `src/app/report-{review,approve,issue,archive}/page.tsx`
- Test: 对应 REF 测试文件（reports 无专属测试目录；audit 无——`tests/msw/handlers.test.ts` 里 audit 断言在 Wave 6 收口）

**Interfaces:**
- Consumes: Task 9 `FlowStagePage`（4 页都是它的参数化实例，以 REF 实际结构为准）
- Produces: 4 条路由 `/report-review|approve|issue|archive`

- [ ] Step 1-4: 拷 → 壳 → tsc → vitest 全量 → commit `feat(nextjs): M03.F05-F08 报告审核/批准/发放/归档 4 页 + 审计日志列表`
- [ ] Step 5: **tree-change**：M03 全模块已上线行推「已上线」（`--report` 列出本波落地 ID → 用户 `--approve`）

### Task 12: Wave 2 gate + msw audit-logs 缺口决策

- [ ] Run: `python scripts/gate.py -p lab-management-system-nextjs` → exit 0
- [ ] audit-logs 缺口处理：msw 仓 `handlers-extra.ts` 补 `GET /api/audit-logs`（返回 flow 转写日志数组，schema 对 REF `types/system` 的 AuditLog）；若本波页面暂无消费方则留到 Wave 6 与测试一起收口——**二选一，在执行时记录决策**

---

## Wave 3 M06 检测能力

### Task 13: inspection-capability 10 组件

**Files:**
- Create: `src/features/inspection-capability/`（REF 10 文件：InspectionCapabilityPage / FormModal / TwoLevelObjectStandardTree / AssociationManager / CalculationRuleList / TechnicalRequirementList / ReportNameList / ParamInterfaceList / ParamInterfacePreviewModal / previewSampleMock）
- Create: `src/app/inspection/page.tsx` + REF router 里 inspection 相关的其余 4 条路由（以 REF `src/app/router.tsx` 实际 inspection 路由段为准逐一镜像）
- Test: REF `tests/features/inspection-capability/` 13 个测试

**Interfaces:**
- Consumes: Task 3 `API_ROUTES`（6 条 link 路由全在这域）、Task 4 generated JSON
- Produces: `/inspection` 检测能力主页（二级树 + 关联管理）+ 计算方法/技术要求/报告名称/参数界面 4 个子页

- [ ] Step 1: 拷 10 文件按移植规则改（link 端点全部走 `API_ROUTES`）
- [ ] Step 2: 按 REF router 的 inspection 路由段建 page.tsx 壳
- [ ] Step 3: 拷 13 测试（.dom）→ vitest PASS
- [ ] Step 4: tsc → commit `feat(nextjs): M06 检测能力 10 组件 + 4 子页 (13 测试)`
- [ ] Step 5: tree-change：M06 已上线行推进（同 Task 11 Step 5 流程）

### Task 14: Wave 3 gate

- [ ] `python scripts/gate.py -p lab-management-system-nextjs` → exit 0

---

## Wave 4 M04 字典 + M05 汇总 + Dashboard

### Task 15: CategoryDictList 4 页

**Files:**
- Create: `src/features/dicts/CategoryDictList.tsx`
- Create: `src/app/{models,specifications,grades,brands}/page.tsx`（各传 endpoint/title/hint props，照 REF router.tsx 对应 4 行的 props 逐字拷，`@entry` 注释带上）
- Test: `tests/features/dicts/CategoryDictTree.dom.test.tsx`

**Interfaces:**
- Consumes: `API_ROUTES`——注意 REF CategoryDictList 调 `/inspection-models` 类端点，M1 表没有 → 执行时确认 REF 实际调用串（REF 走 catalog handler：msw 是 `/api/catalog/models|specs|grades|brands`），在 `API_ROUTES` 追加 4 键：`"/inspection-models": "/catalog/models"` 等

- [ ] Step 1-4: 拷 → 4 壳 → 测试 → commit `feat(nextjs): M04.F06-F09 型号/规格/等级/牌号维护 4 页`
- [ ] Step 5: tree-change M04 推进

### Task 16: SummaryPage + Dashboard

**Files:**
- Create: `src/features/summary/SummaryPage.tsx`、`src/pages/Forbidden.tsx` → `src/features/app/Forbidden.tsx`
- Create: `src/pages/Dashboard.tsx` → `src/features/app/Dashboard.tsx`
- Create: `src/app/summary/page.tsx`、`src/app/dashboard/page.tsx`
- Test: `tests/features/summary/SummaryPageFn.dom.test.tsx`

- [ ] Step 1-4: 拷 → 壳 → 测试 → commit `feat(nextjs): M05.F01 报告汇总 + Dashboard`
- [ ] Step 5: tree-change M05 推进
- [ ] Step 6: Wave 4 gate → exit 0

---

## Wave 5 M00/M01/M02 收口

### Task 17: 路由守卫 + 动态菜单 + Forbidden 路由

**Files:**
- Create: `src/features/app/Protected.tsx`（REF `src/app/guards/ProtectedRoute.tsx` 的 App Router 形态）
- Modify: `src/components/app/sidebar-nav.tsx`（菜单源对齐 REF `useMenus.ts`——GET `/auth/menus?appId=lab-management`，分组+权限码显隐）
- Create: `src/features/auth/{ssoClient,useMenus}.ts`（REF 同名移植；`ssoClient` 的 `import.meta.env` 全走 `env`）
- Create: `src/app/forbidden/page.tsx`
- Test: `tests/app/guards/ProtectedRoute.dom.test.tsx`、`tests/app/layoutMenuFromApi.dom.test.tsx`

**Interfaces:**
- Produces: `<Protected>` 包装组件（未登录 → `/login`；403 → `/forbidden`）+ `useMenus()` hook
- 注意：**不做** REF 的 `/sso-callback` 路由（spec 2.2.1：code+state 回 `/login` 解析，现有逻辑已覆盖）。`ssoRedirectUri()` 改返回 `${origin}/login`

- [ ] Step 1: 移植 ssoClient/useMenus/Protected（守卫组件改用 `usePathname` + `useRouter` from `next/navigation`）
- [ ] Step 2: 给 Wave 2-4 的所有 `src/app/**/page.tsx` 包 `<Protected>`（壳层统一改，features 不动）
- [ ] Step 3: 测试 → commit `feat(nextjs): 路由守卫 + 动态菜单 (委托 saas) + /forbidden`
- [ ] Step 4: tree-change M01.F04/F05、M00 相关行推进（密码登录行**不推**——spec 2.2.1）

### Task 18: contracts 对齐 REF + msw 模式接线

**Files:**
- Create: `src/features/contracts/{ContractList,ContractFormModal}.tsx`（REF 版移植，含分页——本仓现有 contracts page 是简版）
- Modify: `src/app/contracts/page.tsx` → re-export REF 版
- Modify: `src/app/layout.tsx` 或 ClientLayout：dev 模式下 `NEXT_PUBLIC_USE_MSW !== "false"` 时 dynamic import `@lab/management-system-msw/browser` 的 `setupBrowserMocks()`（对照 REF `main.tsx` enableMocking；`public/mockServiceWorker.js` 由 `npx msw init public/ --save` 生成）
- Test: `tests/features/contracts/contractStore.test.ts`（Task 5 已进）+ 补 REF `tests/features/contracts/` 其余

- [ ] Step 1: 移植 REF ContractList/FormModal（换掉本仓简版实现）
- [ ] Step 2: msw browser 接线 + `npx msw init public/ --save`
- [ ] Step 3: 手动冒烟 `npm run dev`：登录 orchestrator → /contracts 列表（msw 数据）→ 编辑弹窗
- [ ] Step 4: commit `feat(nextjs): contracts 对齐 REF (分页+ConfirmModal) + msw browser worker 接线`
- [ ] Step 5: tree-change M02.F01 核对 + Wave 5 gate → exit 0

---

## Wave 6 收口

### Task 19: 测试覆盖对齐 + fnTest 挂 ID 核查

**Files:**
- Modify: `tests/**`（对齐 REF 70 文件清单逐个核对：已拷 / 改名 / 有意不拷三类列表化）
- 有意不拷清单（预判）：`tests/app/router.test.tsx`（react-router 专属）、`tests/features/auth/Login.test.tsx`+`SsoCallback.test.tsx`（spec 2.2.1 不做本地登录页）、`tests/msw/*` 7 个（msw 仓自己的 drift-guard 已覆盖）、`tests/smoke.test.ts`（本仓 db.smoke 替代）

- [ ] Step 1: diff REF tests 清单 vs 本仓 tests 清单，产出三类表写进本任务 commit message
- [ ] Step 2: 遗漏的补齐 → `npm test` 全绿
- [ ] Step 3: 核查 trace.json：`npm run trace` 后对照功能树已上线 ID，缺挂的补 fnTest
- [ ] Step 4: commit `test(nextjs): 测试覆盖对齐 REF (拷 X / 不拷 Y 清单) + fnTest 补挂`

### Task 20: L5 软告警清零 + catch-all 清理 + orval 复查

**Files:**
- Delete: `src/app/[...path]/page.tsx`（先 grep 确认无引用）
- Modify: `docs/design/{design-function-map,flow-function-map}.md`（从 REF 对应文件拷入——L5 需要设计/流程映射）
- Modify: orval 闲置复查——`src/api/endpoints/` 保留（CLAUDE.md 已声明其定位），只在 ADR 记一笔

- [ ] Step 1: 删 catch-all（`grep -rn "\.\.\.path" src/` 确认）
- [ ] Step 2: 拷 REF 2 个 design map（data-fn 映射关系随组件移植已一致，这俩文件是 L5 校验输入）
- [ ] Step 3: `python scripts/gate.py -p lab-management-system-nextjs` → exit 0 且软告警 0
- [ ] Step 4: tree-change 最终核查（已上线行与实际落地一一对应，无漏推/多推）
- [ ] Step 5: commit `chore(nextjs): Wave 6 收口 — catch-all 删除 + design maps + 0 软告警`

### Task 21: 全流程冒烟 + handoff

- [ ] `npm run dev` 手动走通：SSO 登录 → dashboard → contracts → 接样新建 → 任务分配 → 数据录入（水泥/钢筋卡片）→ 报告预览（docx 渲染）→ 审核 → 批准 → 发放 → 归档 → 汇总表（msw 后端）
- [ ] `python scripts/gate.py -p lab-management-system-nextjs` 最终 exit 0
- [ ] `/handoff` 更新 `.state/session.json`
- [ ] commit + tag `v0.2.0-20260814`（版本号执行时与用户确认）

---

## Self-Review 记录

- **Spec 覆盖**：spec §2.1（Task 3）、§2.2 路由表（Task 8-18 各壳）、§2.2.1 认证（Task 17 注意事项 + 有意不拷清单）、§2.3 依赖（Task 1）、§2.4 模板（Task 4/10）、§2.5 store（Task 5）、§3 功能树（Task 6 + 各波 tree-change 步）、§4 测试（Task 2 + 19）、§5 分波（Task 7/12/14/16/18/20 门）、§6 风险（import.meta.env→Task 3 env.ts；模板路径→Task 4；版本冲突→Task 1 tsc 基线；align 预检→Task 6 Step 3；每波 gate→各门）、§7 验收（Task 20/21）。无缺口。
- **占位符**：Task 4 Step 2 脚本含一段自我否定的草稿段并已内联说明正确实现；除此无 TBD。
- **类型一致性**：`API_ROUTES` 键集在 Task 3 定义、Task 15 追加 4 键 catalog；`MANIFEST_BY_BASENAME` Task 4 产出、Task 10 消费；`<Protected>` Task 17 产出并统一包装。
