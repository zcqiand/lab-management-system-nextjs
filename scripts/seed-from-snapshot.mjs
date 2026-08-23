#!/usr/bin/env node
// scripts/seed-from-snapshot.mjs — 把 src/seeds/*.json 灌到目标 PG。
//
// 用途（v0.3.47+）：
//   lab_prod 是空库（DDL 落了但没数据）；从 lab_dev dump 一份快照（src/seeds/*.json）
//   后，用这个脚本灌进 lab_prod。镜像 scripts/dump-db.mjs 的反方向。
//
// 与 scripts/seed-db.ts 的差异：
//   seed-db.ts 读 @lab/management-system-msw/fixtures（仓内 fixture，恒定），
//   适合本地 dev 起手；本脚本读 src/seeds/*.json（PG 快照），
//   适合 prod bootstrap / 灾备恢复 / 跨环境同步。
//
// 行为：
//   - 读 src/seeds/_meta.json 验来源 + 打印计划
//   - 按 FK 拓扑顺序处理表（introspect pg_constraint 反向拓扑排序；CASCADE 兜底）
//   - TRUNCATE <全部目标表> RESTART IDENTITY CASCADE（在 FK 约束下无需关心顺序）
//   - 每张表 INSERT 全量 rows（pg 驱动把 array / jsonb 自动序列化成 PG 字面量）
//   - --dry-run 只打印计划不写
//   - 默认连 lab_prod（fallback URL 与 seed-db.ts 同密码约定）
//
// 用法：
//   DATABASE_URL=postgresql://...lab_prod node scripts/seed-from-snapshot.mjs
//   DATABASE_URL=... node scripts/seed-from-snapshot.mjs --dry-run

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const require = createRequire(resolve(PROJECT_ROOT, "package.json"));
const pg = require("pg");

const DRY_RUN = process.argv.includes("--dry-run");
const SEEDS_DIR = resolve(PROJECT_ROOT, "src/seeds");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_prod";

function loadSnapshot() {
  const metaPath = resolve(SEEDS_DIR, "_meta.json");
  if (!existsSync(metaPath)) {
    throw new Error(`_meta.json not found in ${SEEDS_DIR}; run scripts/dump-db.mjs first`);
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const fs = require("node:fs");
  const tables = {};
  for (const file of fs.readdirSync(SEEDS_DIR)) {
    if (file === "_meta.json" || !file.endsWith(".json")) continue;
    const table = file.replace(/\.json$/, "");
    tables[table] = JSON.parse(readFileSync(resolve(SEEDS_DIR, file), "utf8"));
  }
  return { meta, tables };
}

async function main() {
  const { meta, tables } = loadSnapshot();
  console.log(
    `Snapshot: ${meta.table_count} tables / ${meta.total_rows} rows / dumped_at=${meta.dumped_at} / source=${meta.source_db}`,
  );

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();

  const tableNames = Object.keys(tables);
  if (tableNames.length === 0) {
    throw new Error("snapshot has no tables");
  }

  // TRUNCATE ... RESTART IDENTITY CASCADE — PG 自己按 FK 反向拓扑处理
  const quoted = tableNames.map((t) => `"${t}"`).join(", ");
  if (DRY_RUN) {
    console.log(`[dry-run] would TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
  } else {
    console.log(`→ TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
  }

  // 拓扑排序：parents 先于 children。introspect pg_constraint 找「本表 → 引用的表」
  // 的边，再做 Kahn / DFS topo-sort。CASCADE 已清掉旧数据，这里只决定 INSERT 顺序。
  const fkRes = await client.query(
    `SELECT conrelid::regclass::text AS tbl,
            confrelid::regclass::text AS ref
       FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace`,
  );
  const deps = new Map();
  for (const t of tableNames) deps.set(t, new Set());
  for (const r of fkRes.rows) {
    const tbl = r.tbl.replace(/^"|"$/g, "");
    const ref = r.ref.replace(/^"|"$/g, "");
    if (deps.has(tbl) && deps.has(ref) && tbl !== ref) deps.get(tbl).add(ref);
  }
  // DFS topo-sort（带 visited 标记）
  const ordered = [];
  const visiting = new Set();
  const visit = (t) => {
    if (visiting.has(t)) return; // 环就忽略（CASCADE 处理）
    visiting.add(t);
    for (const d of deps.get(t) ?? []) visit(d);
    ordered.push(t);
  };
  for (const t of tableNames) visit(t);
  // ordered 现在是 parent → child 拓扑序；保持与 tableNames 的相对关系
  // （FSM 反向遍历保证这一点）

  // 预扫描：哪些列是 jsonb（pg driver 不会自动把数组/对象转 jsonb 字面量，
  // 需要显式 JSON.stringify 后再传。对象字面量它能处理，array-of-object 不行。）
  const jsonbColsByTable = new Map();
  for (const table of tableNames) {
    const r = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND data_type = 'jsonb'`,
      [table],
    );
    jsonbColsByTable.set(table, new Set(r.rows.map((x) => x.column_name)));
  }

  // INSERT：依赖 PG driver 把对象/数组序列化成字面量（jsonb / uuid[] / text[]）
  for (const table of ordered) {
    const rows = tables[table];
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = rows
      .map(
        (_, r) =>
          `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(", ")})`,
      )
      .join(", ");
    const jsonbCols = jsonbColsByTable.get(table) ?? new Set();
    const values = rows.flatMap((r) =>
      cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return null;
        // jsonb：只要不是 string 都 JSON.stringify（pg driver 不会自动做）
        if (jsonbCols.has(c)) {
          return typeof v === "string" ? v : JSON.stringify(v);
        }
        return v;
      }),
    );
    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders}`;
    if (DRY_RUN) {
      console.log(`[dry-run] would INSERT ${rows.length} rows into "${table}"`);
    } else {
      try {
        await client.query(sql, values);
      } catch (e) {
        console.error(`  ✗ ${table}: ${e.message}`);
        console.error(`    sql: ${sql.slice(0, 200)}...`);
        // 试找出具体哪一行哪一列出错
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < cols.length; c++) {
            const v = rows[r][cols[c]];
            if (v !== null && typeof v === "object") {
              try { JSON.stringify(v); } catch (jse) {
                console.error(`    row ${r} col ${cols[c]} = ${JSON.stringify(v).slice(0,100)} (circular?)`);
              }
            }
          }
        }
        throw e;
      }
      console.log(`  ${table}: ${rows.length} rows inserted`);
    }
  }

  if (!DRY_RUN) {
    console.log("\n✓ done. verify with: SELECT tablename, n_live_tup FROM pg_stat_user_tables;");
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
