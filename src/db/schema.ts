import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * SQLite 表。
 *
 * 约定：
 *   - 改这张表的列后，跑 `npx drizzle-kit generate` 让它出新迁移。
 *   - 手动编辑 drizzle/000N_*.sql 是禁止的（见项目 CLAUDE.md 禁止事项）。
 *   - 字段命名 snake_case，与 SQL 习惯对齐。
 *   - 业务表到达后新增；目前只放 health_check 让 route handler /api/health 有可读写的表。
 */
export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ok: integer("ok").notNull(),
  checkedAt: text("checked_at")
    .notNull()
    .default("(datetime('now'))"),
});

export type HealthCheckRow = typeof healthCheck.$inferSelect;
export type NewHealthCheckRow = typeof healthCheck.$inferInsert;
