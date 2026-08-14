// scripts/borrow-from-nextjs-pg.mjs — 可被 sibling 从外部 reach 进来的借链测试入口。
//
// 镜像 saas-identity-platform-nextjs/scripts/borrow-from-nextjs-pg.mjs（已存在那里）。
// 这一对「borrow / borrow-from」脚本的目的：
//   - 让 shared/sync-db.mjs 与 saas/nextjs 的 db.smoke 都有同款形状的「loader 入口」
//   - 自带自检：跑通了 = shared 的 sync-db 一定能用
//
// 用法（在 sibling 仓）：
//   const selfRequire = createRequire(resolve(<nextjsRoot>, "package.json"));
//   const pg = selfRequire("pg");
//
// 或者在本仓自检：
//   node scripts/borrow-from-nextjs-pg.mjs

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
  console.error(`[borrow-from-nextjs-pg] FATAL: require pg 失败 — ${e.message}`);
  process.exit(1);
}

const { Client } = pg;
const c = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE });
try {
  await c.connect();
  const r = await c.query("SELECT current_database() AS db, current_user AS u");
  console.log(`[borrow-from-nextjs-pg] OK ${USER}@${HOST}:${PORT}/${DATABASE} → db=${r.rows[0].db} user=${r.rows[0].u}`);
  await c.end();
  process.exit(0);
} catch (e) {
  console.error(`[borrow-from-nextjs-pg] FAIL ${e.message}`);
  try { await c.end(); } catch {}
  process.exit(2);
}
