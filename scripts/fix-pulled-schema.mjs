// scripts/fix-pulled-schema.mjs — drizzle-kit pull 产物后处理（D2 ruling，ADR-0033 起作用于 src/db/schema.ts）。
// 修两类已知缺陷，保证 `npx tsc --noEmit` 过：
//   1. `.default(')` → `.default('')`：pull 对「text NOT NULL DEFAULT ''」列丢引号，
//      产物是空模板串 `.default(')`，随机炸 typecheck/运行时。
//   2. 删掉 import 里未使用的 `sql`（pull 只有在用到 sql`` 时才需要它）。
// 幂等：已修过的文件再跑一遍是 no-op。由 scripts/pull-schema.sh step 3 自动调用。
//
// 已知不修（pull 保真度限制，ORM 查询无感）：约束名 param_interfaces_pkey 等
// 遗留名 pull 会丢（渲染成列级 .primaryKey()）；真名以 shared schema.ts / 真库为准。
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../src/db/schema.ts", import.meta.url);
const before = readFileSync(FILE, "utf8");
let src = before;
let fixes = 0;

// 1) 空串默认值补引号
const brokenDefaults = src.match(/\.default\('\)/g)?.length ?? 0;
if (brokenDefaults > 0) {
  src = src.replaceAll(".default(')", ".default('')");
  fixes += brokenDefaults;
}

// 2) import 列表里的 unused sql（仅当文件其余处没用到 sql 时才删）
//    新版 drizzle-kit 把 sql 拆成独立第二行 `import { sql } from "drizzle-orm"`，
//    老逻辑只清第一个 import 块内的 sql -- 两条路径都要覆盖（2026-08-26）。
const withoutImports = src.replace(/import\s*\{[^}]*}\s*from\s*"[^"]*"/g, "");
const usesSqlBeyondImport = /\bsql[.(`]/.test(withoutImports);
if (!usesSqlBeyondImport && /(^|\s|,)\s*sql\s*(,|})/.test(src.match(/import\s*\{[^}]*\}/)?.[0] ?? "")) {
  const importBlock = src.match(/import\s*\{[^}]*\}/)[0];
  const cleaned = importBlock
    .replace(/\s*,\s*sql\s*(?=[,}])/, "")
    .replace(/(\{\s*)sql\s*,\s*/, "$1")
    .replace(/(\{\s*)sql\s*\}/, "$1}");
  if (cleaned !== importBlock) {
    src = src.replace(importBlock, cleaned);
    fixes++;
  }
}
// 2b) 独立整行的 unused sql import（新版 drizzle-kit 产物形状）
if (!usesSqlBeyondImport) {
  const standalone = /^import\s*\{\s*sql\s*\}\s*from\s*"drizzle-orm";?\s*\r?\n/gm;
  const hits = src.match(standalone);
  if (hits) {
    src = src.replace(standalone, "");
    fixes += hits.length;
  }
}

if (src !== before) {
  writeFileSync(FILE, src);
  console.log(`fix-pulled-schema: applied ${fixes} fix(es) to src/db/schema.ts`);
} else {
  console.log("fix-pulled-schema: nothing to fix (already clean)");
}
