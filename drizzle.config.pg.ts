import { defineConfig } from "drizzle-kit";

/**
 * PG emit dialect 的 drizzle config。
 *
 * 仅供 `drizzle-kit pull` 用：emit-schema.mjs replay V*.sql 之后，用本 config 从
 * 连接 introspect 当前 PG catalog，写出 generated/schema.ts。
 *
 * `schema` 指向 src/db/schema.ts —— 那是个 `export const pgSchema = []` 占位文件，
 * 因为本仓**不手抄** PG 表（让 drizzle-kit pull 自动 introspect）。
 *
 * 输出到 generated/；`generated/` 已在 .gitignore 内。
 */

// 优先 DATABASE_URL(单 string,ADR-0009);缺失时回退到 PG_* 拼(兼容 dev 本地与姊妹仓)。
const DATABASE_URL = process.env.DATABASE_URL;
const host = process.env.PG_HOST ?? "100.79.128.25";
const port = Number(process.env.PG_PORT ?? 5432);
const user = process.env.PG_USER ?? "postgres";
const password = process.env.PG_PASSWORD ?? "qiand68+++";
const database = process.env.PG_DATABASE ?? "lab_dev";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./generated",
  dialect: "postgresql",
  dbCredentials: DATABASE_URL
    ? { url: DATABASE_URL, ssl: false }
    : { host, port, user, password, database, ssl: false },
  verbose: false,
  strict: true,
});
