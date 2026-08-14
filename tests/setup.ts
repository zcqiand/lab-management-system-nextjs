/**
 * vitest 全局 setup：跑迁移，把 :memory: 的 SQLite 里建出和 dev 一致的表。
 *
 * 在生产里 dev.db 已经被 `npm run db:migrate` 应用过；测试冷启动时 dev 不存在，靠这里补齐。
 * server-only stub 由 vitest.config.ts 的 resolve.alias 兜住，不依赖这个文件。
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/db";

migrate(db, { migrationsFolder: "./drizzle" });
