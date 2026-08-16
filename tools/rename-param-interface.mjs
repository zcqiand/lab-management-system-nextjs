// tools/rename-param-interface.mjs
// 一次性迁移：把 "param-interface" 全部加 "inspection-" 前缀
//   paramInterface (camelCase) → inspectionParamInterface
//   ParamInterface (PascalCase) → InspectionParamInterface
//   /param-interfaces → /inspection-param-interfaces
// 重要：用负向预查避开已加 inspection- 前缀的字符串，确保幂等。

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src");
const TESTS = resolve(__dirname, "../tests");

const REPLACEMENTS = [
  // 0. 反向修正（防双前缀残留）
  [/\/inspection-inspection-/g, "/inspection-"],
  // 1. URL slugs
  [/(?<![a-zA-Z-])\/param-interfaces\b/g, "/inspection-param-interfaces"],
  [/(?<![a-zA-Z-])\/param-interface\b/g, "/inspection-param-interface"],
  [/(?<![a-zA-Z-])param-interfaces\b/g, "inspection-param-interfaces"],
  [/(?<![a-zA-Z-])param-interface\b/g, "inspection-param-interface"],
  // 2. Identifiers
  [/(?<![A-Za-z])ParamInterface\b/g, "InspectionParamInterface"],
  [/(?<![A-Za-z])paramInterfaceLinks\b/g, "inspectionParamInterfaceLinks"],
  [/(?<![A-Za-z])paramInterfaces\b/g, "inspectionParamInterfaces"],
  [/(?<![A-Za-z])getParamInterface\b/g, "getInspectionParamInterface"],
  [/(?<![A-Za-z])paramInterfaceCode\b/g, "inspectionParamInterfaceCode"],
  [/(?<![A-Za-z])paramInterface\b/g, "inspectionParamInterface"],
];

let touched = 0, total = 0;
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
    const p = resolve(dir, e.name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (st.isFile() && /\.(ts|tsx|js|mjs|json)$/.test(e.name)) {
      const orig = readFileSync(p, "utf8");
      let next = orig, n = 0;
      for (const [pat, rep] of REPLACEMENTS) {
        const m = next.match(pat);
        if (m) { n += m.length; next = next.replace(pat, rep); }
      }
      if (n > 0) {
        writeFileSync(p, next, "utf8");
        touched += 1; total += n;
        console.log(`  ${p.replace(SRC, "src").replace(TESTS, "tests")}: ${n}`);
      }
    }
  }
}

console.log("[rename] 扫 src/ ..."); walk(SRC);
console.log("[rename] 扫 tests/ ..."); walk(TESTS);
console.log(`[rename] 改 ${touched} 文件，${total} 处替换`);
