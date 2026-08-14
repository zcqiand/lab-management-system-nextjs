import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "./schema";

/**
 * DB client — `pg` + drizzle-orm/node-postgres。
 *
 * 与 saas-identity-platform-nextjs 的差异：saas 用 postgres-js + drizzle-orm/postgres-js；
 * 本仓用裸 `pg` + drizzle-orm/node-postgres。
 * 理由：本仓是 infra 角色，db client 主要是**借链出口**（被 ../lab-management-system-shared
 * 的 sync-db.mjs 与 ../saas-identity-platform-nextjs 的 db.smoke.test.ts 借 require("pg")）。
 * 统一 driver 避免「借 `pg` 跑 raw query、本仓用 postgres-js 跑 drizzle」的双栈。
 *
 * 「server-only」：
 * - 本模块只允许 Route Handler / Server Action / Server Component 引入
 * - client component import：build 期会报 'server-only'
 * - 详见 profiles/nextjs.toml §[stack_rules].forbid + docs/conventions/nextjs.md
 */
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. See docs/conventions/nextjs.md §凭据 (ADR-0009).",
  );
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 10, idleTimeoutMillis: 20_000 });

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export { schema };
