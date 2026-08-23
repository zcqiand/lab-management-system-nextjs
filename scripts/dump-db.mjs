#!/usr/bin/env node
// scripts/dump-db.mjs — 把 lab_dev 当前数据按表 dump 成 JSON。
//
// 用途（v0.3.47+）：
//   lab_prod 是空库（只有 DDL 没数据）；从 lab_dev 抽一份快照当种子，
//   给 init / bootstrap / 灾备恢复用。镜像 saas 仓 scripts/seed-db.mjs 的
//   「读 src/seeds/*.json 灌 PG」反方向。
//
// 行为：
//   - 读 src/seeds/_meta.json 的 tables[]（如果有）按声明顺序 dump，否则按
//     pg_tables 自然顺序
//   - 跳过系统表（__schema_migrations / flyway_schema_history / 表名含 _view）
//   - 跳过空表（count=0 不写文件，省噪音）
//   - 每张表 dump 全量 SELECT *，按主键（或 id）升序，输出 src/seeds/<table>.json
//   - JSON 顶层：{ "_meta": { dumped_at, table_count, total_rows }, "tables": {...} }
//     （_meta 给人看；tables 给 loader 看）
//
// 用法：
//   DATABASE_URL=postgresql://...lab_dev node scripts/dump-db.mjs
//   DATABASE_URL=... node scripts/dump-db.mjs --out=custom-dir

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const require = createRequire(resolve(PROJECT_ROOT, "package.json"));
const pg = require("pg");

const argOutIdx = process.argv.findIndex((a) => a.startsWith("--out="));
const OUT_DIR = argOutIdx >= 0
  ? resolve(process.cwd(), process.argv[argOutIdx].slice("--out=".length))
  : resolve(PROJECT_ROOT, "src/seeds");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev";

const SKIP_TABLES = new Set([
  "__schema_migrations",
  "flyway_schema_history",
]);

const client = new pg.Client({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 8000,
});

async function main() {
  await client.connect();
  const tablesRes = await client.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT LIKE '\\_%' ESCAPE '\\'
     ORDER BY tablename`,
  );
  const candidates = tablesRes.rows.map((r) => r.tablename);

  const tableData = {};
  let totalRows = 0;
  let dumpedCount = 0;
  const skipped = [];

  for (const table of candidates) {
    if (SKIP_TABLES.has(table)) {
      skipped.push(`${table} (system)`);
      continue;
    }
    // 探测列：拿主键做 ORDER BY（保证 dump 顺序稳定）
    const pkRes = await client.query(
      `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = $1::regclass AND i.indisprimary
         ORDER BY array_position(i.indkey, a.attnum)`,
      [`"${table}"`],
    );
    const pk = pkRes.rows.map((r) => r.attname);
    const orderBy = pk.length > 0 ? `ORDER BY ${pk.map((c) => `"${c}"`).join(", ")}` : "";

    const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    const n = countRes.rows[0].n;
    if (n === 0) {
      skipped.push(`${table} (empty)`);
      continue;
    }

    const dataRes = await client.query(`SELECT * FROM "${table}" ${orderBy}`);
    tableData[table] = dataRes.rows;
    totalRows += n;
    dumpedCount += 1;
    process.stdout.write(`  ${table}: ${n} rows\n`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // 逐表落盘
  for (const [table, rows] of Object.entries(tableData)) {
    writeFileSync(
      resolve(OUT_DIR, `${table}.json`),
      JSON.stringify(rows, null, 2) + "\n",
      "utf8",
    );
  }

  // _meta 给人看（loader 不依赖，dump 时间 / 来源 / 表数）
  const meta = {
    dumped_at: new Date().toISOString(),
    source_db: new URL(DATABASE_URL).pathname.replace(/^\//, ""),
    table_count: dumpedCount,
    total_rows: totalRows,
    skipped,
  };
  writeFileSync(
    resolve(OUT_DIR, "_meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );

  console.log(`\n✓ dumped ${dumpedCount} tables (${totalRows} rows) to ${OUT_DIR}`);
  if (skipped.length > 0) {
    console.log(`  skipped: ${skipped.join(", ")}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
