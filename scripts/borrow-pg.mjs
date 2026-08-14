// scripts/borrow-pg.mjs — sanity check the pg-borrow chain that
// ../lab-management-system-shared/scripts/sync-db.mjs depends on.
//
// 退出码:
//   0  pg 可加载 + lab_dev 可达
//   1  pg 包未装（没跑 npm install）
//   2  pg 已装但连不上（env 错 / 网络错）

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const HOST = process.env.PG_HOST ?? "100.79.128.25";
const PORT = Number(process.env.PG_PORT ?? 5432);
const USER = process.env.PG_USER ?? "postgres";
const PASSWORD = process.env.PG_PASSWORD ?? "qiand68+++";
const DATABASE = process.env.PG_DATABASE ?? "lab_dev";

let pg;
try {
  const selfRequire = createRequire(resolve(ROOT, "package.json"));
  pg = selfRequire("pg");
} catch (e) {
  console.error(`[borrow-pg] FATAL: pg 不可加载 — ${e.message}`);
  console.error(`  请先在 ${ROOT} 跑 npm install`);
  process.exit(1);
}

console.log(`[borrow-pg] pg loaded OK  (version=${pg?.version ?? pg?.native?.version ?? "unknown"})`);
console.log(`[borrow-pg] target  ${USER}@${HOST}:${PORT}/${DATABASE}`);

const { Client } = pg;
const c = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE });
try {
  await c.connect();
  const r = await c.query("SELECT 1 AS ok, current_database() AS db, current_user AS u");
  console.log(`[borrow-pg] OK      SELECT 1 → ok=${r.rows[0].ok} db=${r.rows[0].db} user=${r.rows[0].u}`);
  await c.end();
  process.exit(0);
} catch (e) {
  console.error(`[borrow-pg] FAIL    ${e.message}`);
  try { await c.end(); } catch {}
  process.exit(2);
}
