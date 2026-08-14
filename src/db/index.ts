import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Drizzle + SQLite 单例。
 *
 * 同名 globalThis 兜底避免 Next HMR 反复新建 connection。
 * 顶层 import 'server-only'：禁止被 client bundle 拽进去，否则 better-sqlite3 的 native
 * binding 会爆。
 *
 * 数据文件：
 *   - 缺省 ./data/dev.db，.gitignore 屏蔽
 *   - DB_PATH=':memory:' 用于测试，得到一个进程内临时库
 *
 * 改 src/db/schema.ts 后，跑：
 *   npx drizzle-kit generate        # 生成迁移 SQL
 *   npx drizzle-kit migrate         # 应用到 dev.db
 * 启动时不会自动跑迁移 —— 由 `npm run dev` 脚本里的 prerun 钩子或 CI 兜底。
 */

const DB_PATH = process.env.DB_PATH ?? "data/dev.db";

type DbHandle = BetterSQLite3Database<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __drizzle: DbHandle | undefined;
}

function open(): DbHandle {
  const sqlite = new Database(DB_PATH);
  if (DB_PATH !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }
  return drizzle(sqlite, { schema });
}

export const db: DbHandle = globalThis.__drizzle ?? (globalThis.__drizzle = open());
