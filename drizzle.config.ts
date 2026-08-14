import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 配置（双 dialect）。
 *
 *   `npm run db:generate`              → sqlite smoke（L4 用），认 default
 *   `pnpm exec drizzle-kit pull --config=drizzle.config.pg.ts`  → PG emit 脚本用
 *
 * 内存 SQLite 走 src/db/index.ts；PG 不走 drizzle client，只走原生 `pg`（emit-script 拼 SQL）。
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH ?? "data/dev.db",
  },
  verbose: true,
  strict: true,
});
