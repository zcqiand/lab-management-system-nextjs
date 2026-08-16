import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DB client — postgres-js + drizzle-orm（对齐 saas-identity-platform-nextjs/src/db/index.ts）。
//
// 「server-only」：只允许 Route Handler / Server Action / Server Component 引入；
// vitest 由 tests/server-only.stub.ts alias 兜底。
// pg（node-postgres）不再被 src/ 运行时引用，但仍留 devDependencies：
// sync-db.mjs / borrow-pg.mjs 的借链走的是本仓 node_modules 顶层的 pg
//（drizzle-orm 的 pg 只是 optional peer，npm 不会自动安装，物理包由 devDep 保证）。
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. See docs/conventions/nextjs.md §凭据 (ADR-0009).",
  );
}

const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
