// scripts/emit-schema.mjs — consume shared/sql/migrations/V*.sql, replay into temp PG,
// emit `generated/schema.sql` (pg_dump --schema-only) + `generated/schema.ts` (drizzle-kit pull).
//
// 设计（与 ADR-0007 配套）：
//   - lab-management-system-shared/sql/migrations/V*.sql 是 DB schema 的 SSOT。
//   - 本脚本把 SSOT replay 到 lab_dev（PG @ 100.79.128.25），用 pg_dump 拿「当前态 schema」做
//     跨仓对齐的统一锚点 —— msw/未来 backend 都对比 generated/schema.* 而不是手抄的 V 文件。
//   - 默认先清空目标库（lib_dev 永远只是 emit 用临时库，不当生产库）。
//   - 借 pg 走本仓 devDep 的 `pg`（这就是 sync-db.mjs 同款借链）。
//
// 退出码：
//   0  全部 emit 成功
//   1  参数错 / 路径找不到
//   2  pg 不可达
//   3  replay 中途某条 V 失败（已回滚到 drop 后状态）
//   4  pg_dump 失败 / drizzle-kit pull 失败

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SHARED = resolve(ROOT, "../lab-management-system-shared");
const MIGRATIONS = resolve(SHARED, "sql/migrations");
const OUT = resolve(ROOT, "generated");

const PG = requirePg();
const HOST = process.env.PG_HOST ?? "100.79.128.25";
const PORT = Number(process.env.PG_PORT ?? 5432);
const USER = process.env.PG_USER ?? "postgres";
const PASSWORD = process.env.PG_PASSWORD ?? "qiand68+++";
const DATABASE = process.env.PG_DATABASE ?? "lab_dev";

const DRY_RUN = process.argv.includes("--dry-run");

function requirePg() {
  try {
    const selfRequire = createRequire(resolve(ROOT, "package.json"));
    return selfRequire("pg");
  } catch (e) {
    console.error(`[emit-schema] FATAL: 不能 require("pg"): ${e.message}`);
    console.error(`  请先在 ${ROOT} 跑 npm install`);
    process.exit(1);
  }
}

function listMigrations() {
  if (!existsSync(MIGRATIONS)) {
    console.error(`[emit-schema] FATAL: migrations 不存在: ${MIGRATIONS}`);
    process.exit(1);
  }
  return readdirSync(MIGRATIONS)
    .filter((f) => /^V\d+__.+\.sql$/.test(f))
    .sort();
}

async function replay(client, files) {
  console.log(`[emit-schema] DROP SCHEMA public CASCADE + CREATE SCHEMA public`);
  await client.query(`DROP SCHEMA public CASCADE`);
  await client.query(`CREATE SCHEMA public`);

  let applied = 0;
  for (const f of files) {
    const path = resolve(MIGRATIONS, f);
    const sql = readFileSync(path, "utf8");
    const line = f.replace(/^V\d+__/, "").replace(/\.sql$/, "").replace(/_/g, " ");
    process.stdout.write(`[emit-schema]   apply  ${f}  (${line})  ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`OK`);
      applied++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.log(`FAIL\n  ${e.message}`);
      console.error(`[emit-schema] replay 在第 ${applied + 1}/${files.length} 步中断（${f}）`);
      process.exit(3);
    }
  }
  return applied;
}

function pgDump(host, port, user, password, database) {
  const args = ["-h", host, "-p", String(port), "-U", user, "-d", database,
    "--schema-only", "--no-owner", "--no-privileges", "--no-comments"];
  const env = { ...process.env, PGPASSWORD: password };
  const r = spawnSync("pg_dump", args, { env, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`[emit-schema] pg_dump 失败:\n${r.stderr ?? r.stdout ?? "(no output)"}`);
    process.exit(4);
  }
  return r.stdout;
}

function drizzleKitPull() {
  const r = spawnSync("npx", ["--no", "drizzle-kit", "pull", "--config=drizzle.config.pg.ts"],
    { cwd: ROOT, encoding: "utf8", stdio: "inherit" });
  if (r.status !== 0) process.exit(4);
}

async function main() {
  const files = listMigrations();
  console.log(`[emit-schema] found ${files.length} migrations  under ${MIGRATIONS}`);
  console.log(`[emit-schema] range ${files[0]} .. ${files.at(-1)}`);

  if (DRY_RUN) {
    for (const f of files) console.log(`  - ${f}`);
    console.log(`[emit-schema] DRY-RUN（--dry-run）— 不连 PG`);
    process.exit(0);
  }

  mkdirSync(OUT, { recursive: true });

  const { Client } = PG;
  const c = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE });

  console.log(`[emit-schema] connecting to ${USER}@${HOST}:${PORT}/${DATABASE}`);
  try {
    await c.connect();
  } catch (e) {
    console.error(`[emit-schema] FAIL connect: ${e.message}`);
    process.exit(2);
  }
  const applied = await replay(c, files);
  console.log(`[emit-schema] replayed ${applied} migrations`);
  await c.end();

  console.log(`[emit-schema] pg_dump --schema-only → generated/schema.sql`);
  const sql = pgDump(HOST, PORT, USER, PASSWORD, DATABASE);
  writeFileSync(resolve(OUT, "schema.sql"), sql);

  console.log(`[emit-schema] drizzle-kit pull → generated/schema.ts`);
  drizzleKitPull();

  console.log(`[emit-schema] v-sql-to-dbml.mjs → generated/schema.dbml`);
  const v = spawnSync("node", [resolve(__dirname, "v-sql-to-dbml.mjs")], { encoding: "utf8", stdio: "inherit" });
  if (v.status !== 0) process.exit(4);

  console.log(`[emit-schema] DONE  → ${OUT}/schema.{sql,ts,dbml}`);
}

main().catch((e) => {
  console.error(`[emit-schema] FATAL: ${e.message}\n${e.stack ?? ""}`);
  process.exit(1);
});
