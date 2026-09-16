// scripts/gen-shared.ts — shared 仓 API 契约同步（ADR-0025 / ADR-0026）
//
// API 层：shared/tsp → shared/openapi.yaml → 本仓 src/api/endpoints/<tag>/<tag>.ts +
// src/api/endpoints/model/<schema>.ts（orval tags-split，spec §2.1）
// DB 层：nextjs 走 DB-First（drizzle-kit pull，见 scripts/pull-schema.sh）
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sharedDir = resolve(root, "../lab-management-system-shared");

console.log("[gen-shared] step 1/2 — shared: emit OpenAPI.yaml...");
execSync("npm run emit:openapi", { cwd: sharedDir, stdio: "inherit" });

console.log("[gen-shared] step 2/2 — nextjs: orval → src/api/endpoints/...");
execSync("npx orval", { cwd: root, stdio: "inherit" });

console.log("[gen-shared] OK");
console.log("[gen-shared]    DB schema 同步请跑: bash scripts/pull-schema.sh");

// ADR-0026 §2: 写 last-gen-shared.json marker（API 类别）。
// 非 git 仓环境（Docker builder）跳过，仅 WARN——marker 块本意即不阻塞构建。
try {
  const sharedSha = execSync("git rev-parse HEAD", { cwd: sharedDir })
    .toString()
    .trim();
  const markerPath = resolve(root, ".state/last-gen-shared.json");
  mkdirSync(resolve(root, ".state"), { recursive: true });

  let marker: Record<string, unknown> = {};
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    /* 首次写 */
  }

  const now = new Date().toISOString();
  marker["api_synced_sha"] = sharedSha;
  marker["api_synced_at"] = now;
  marker["api_synced_cmd"] = "gen-shared.ts";
  const shas = [marker["api_synced_sha"], marker["db_synced_sha"]].filter(
    Boolean,
  ) as string[];
  marker["shared_sha"] = shas.length > 0 ? shas.sort().at(-1) : sharedSha;
  marker["consumer_repo"] = "lab-management-system-nextjs";

  writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n");
  console.log(`[gen-shared]    ADR-0026 marker 已落盘: ${markerPath} (shared HEAD ${sharedSha.slice(0, 7)})`);
} catch (err) {
  console.log(
    `[gen-shared]    WARN: 非 git 仓或 marker 写失败——跳过（staleness 将报 UNKNOWN）: ${err instanceof Error ? err.message : err}`,
  );
}
