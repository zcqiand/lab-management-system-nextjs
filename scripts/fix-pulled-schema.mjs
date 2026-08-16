// scripts/fix-pulled-schema.mjs — drizzle-kit pull 产物后处理（D2 ruling）。
// 修两类已知缺陷，保证 `npx tsc --noEmit` 过：
//   1. `.default(')` → `.default('')`：pull 对「text NOT NULL DEFAULT ''」列丢引号，
//      产物是空模板串 `.default(')`，随机炸 typecheck/运行时。
//   2. 删掉 import 里未使用的 `sql`（pull 只有在用到 sql`` 时才需要它）。
// 幂等：已修过的文件再跑一遍是 no-op。用法：npm run fix:schema（drizzle:pull 后跑）。
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../generated/schema.ts", import.meta.url);
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

if (src !== before) {
  writeFileSync(FILE, src);
  console.log(`fix-pulled-schema: applied ${fixes} fix(es) to generated/schema.ts`);
} else {
  console.log("fix-pulled-schema: nothing to fix (already clean)");
}
