import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { healthCheck } from "@/db/schema";

/**
 * Smoke test: confirm src/db/index.ts factory + Drizzle query API are wired up
 * against the in-memory SQLite that vitest injects via DB_PATH.
 *
 * 这是结构性验证，不挂业务功能 ID（参见 tests/fn.ts 的纪律部分）。
 * 真业务测试落在新功能自己的 *.test.ts 里。
 */
describe("db factory", () => {
  it("inserts and counts rows via Drizzle query builder", () => {
    db.insert(healthCheck).values({ ok: 1 }).run();

    const row = db
      .select({ n: sql<number>`count(*)` })
      .from(healthCheck)
      .get();

    expect(Number(row?.n ?? 0)).toBeGreaterThan(0);
  });
});
