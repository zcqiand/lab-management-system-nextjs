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
// 5.86: orval 原始产物非 prettier 形态（L1 门按 prettier 收）——内建格式化令 regen 严格 byte-idempotent（5.23 spotless 先例）
console.log("[gen-shared] step 2b — prettier --write src/api/endpoints");
execSync('npx --no -- prettier --write "src/api/endpoints/**/*.ts"', { cwd: root, stdio: "inherit" });


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

  // 5.77（2026-09-21 人裁立项）：同 sha 零写入——api_synced_sha 与现存 marker 相同 →
  // 整个 marker 文件零写入（时间戳/mtime 不动，字节级幂等）；sha 真变才全量写。
  if (marker["api_synced_sha"] === sharedSha) {
    console.log(
      `[gen-shared]    ADR-0026 marker sha 未变，零写入（5.77 同 sha 不刷时间戳）: ${markerPath}`,
    );
  } else {
    const now = new Date().toISOString();
    marker["api_synced_sha"] = sharedSha;
    marker["api_synced_at"] = now;
    marker["api_synced_cmd"] = "gen-shared.ts";
    // shared_sha 取最近一次同步：ISO-8601 UTC 时间戳字典序==时间序（5.21 修复，勿 sort sha）。
    const entries: Array<[string, string]> = (["api_synced", "db_synced"] as const)
      .map((k) => [String(marker[`${k}_at`] ?? ""), String(marker[`${k}_sha`] ?? "")] as [string, string])
      .filter(([, sha]) => sha !== "");
    marker["shared_sha"] = entries.length
      ? entries.sort((a, b) => a[0].localeCompare(b[0])).pop()![1]
      : sharedSha;
    marker["consumer_repo"] = "lab-management-system-nextjs";

    writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n");
    console.log(`[gen-shared]    ADR-0026 marker 已落盘: ${markerPath} (shared HEAD ${sharedSha.slice(0, 7)})`);
  }
} catch (err) {
  console.log(
    `[gen-shared]    WARN: 非 git 仓或 marker 写失败——跳过（staleness 将报 UNKNOWN）: ${err instanceof Error ? err.message : err}`,
  );
}
