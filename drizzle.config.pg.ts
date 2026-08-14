import { defineConfig } from "drizzle-kit";

/**
 * PG emit dialect 的 drizzle config。
 *
 * 路由：本仓不直接用 drizzle-orm/pg 跑查询（emit 全走裸 `pg` + 自拼 SQL）。
 * 这个文件仅供 `drizzle-kit pull` 用：emit-schema.mjs 在 replay 完 V*.sql 之后，
 * 用本 config 从连接里 introspect 当前 PG catalog，写出 generated/schema.ts。
 *
 * `schema` 设为空数组即可——drizzle-kit pull 不需要源 schema 文件。
 *
 * `out` 写到 generated/；`generated/` 已在 .gitignore 内，故 DB-emit 产物不污染 git 历史。
 */

const host = process.env.PG_HOST ?? "100.79.128.25";
const port = Number(process.env.PG_PORT ?? 5432);
const user = process.env.PG_USER ?? "postgres";
const password = process.env.PG_PASSWORD ?? "qiand68+++";
const database = process.env.PG_DATABASE ?? "lab_dev";

export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./generated",
  dialect: "postgresql",
  dbCredentials: { host, port, user, password, database, ssl: false },
  verbose: false,
  strict: true,
});
