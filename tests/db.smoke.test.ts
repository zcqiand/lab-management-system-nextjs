// DB smoke test：借 pg + 跑 shared target DDL + select 1 + count information_schema.tables。
//
// 镜像 saas-identity-platform-nextjs/tests/db.smoke.test.ts。
// ADR-0033 阶段一起 shared 的 DDL 真源是 src/db/schema.ts（Drizzle schema-first），
// 物化产物为 ../lab-management-system-shared/drizzle/0000_target_ddl.sql——
// 本测试把它灌进独立 schema `lab_smoke`（不碰 public，seed 数据不受影响），
// 校验三点：SELECT 1 / 24 张表齐全 / tenant_id 列存在。
//
// 跳过条件：DATABASE_URL 未设 / `npm install` 没装 pg 时。CI 实跑。
//
// pg 借链 smoke：本仓持有 pg devDep，shared 仓 replay 测试借它 require("pg")
//（ADR-0033 阶段二：infra 段自 function-tree 退役，fnTest 解挂为普通 it）。

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TARGET_DDL = resolve(
  ROOT,
  "../lab-management-system-shared/drizzle/0000_target_ddl.sql",
);

type PgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  end(): Promise<void>;
};

let pgModule: { Client: new (cfg: unknown) => PgClient } | null = null;
try {
  const selfRequire = createRequire(resolve(ROOT, "package.json"));
  pgModule = selfRequire("pg") as { Client: new (cfg: unknown) => PgClient };
} catch {
  // 借不到就 skip
}

const DATABASE_URL = process.env.DATABASE_URL;
const SMOKE_SCHEMA = "lab_smoke";
// 与 shared tests/drizzle.replay.test.ts 的 EXPECTED_TABLES 一致（24 张业务表；
// audit_events 表已全链清理，2026-09-20，5.65）
const EXPECTED_TABLES = 24;

describe("DB smoke (PG)", () => {
  if (!pgModule || !DATABASE_URL) {
    it.skip("pg or DATABASE_URL unavailable", () => {});
    return;
  }

  let client: PgClient | null = null;

  beforeAll(async () => {
    client = new pgModule.Client({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();

    // 用独立 schema 隔离。DROP/CREATE lab_smoke 不影响 public。
    // drizzle 产物把 enum 写成 `CREATE TYPE "public".<name>`（显式限定，search_path
    // 管不到），直接灌会撞真库 public 里已存在的同名 enum——统一改写限定符落进
    // lab_smoke；表/列本身不带前缀，经 search_path 同样落进隔离 schema。
    await client.query(`DROP SCHEMA IF EXISTS "${SMOKE_SCHEMA}" CASCADE`);
    await client.query(`CREATE SCHEMA "${SMOKE_SCHEMA}"`);
    await client.query(`SET search_path TO "${SMOKE_SCHEMA}"`);

    const ddl = readFileSync(TARGET_DDL, "utf8").replaceAll(
      `"public".`,
      `"${SMOKE_SCHEMA}".`,
    );
    await client.query(ddl);
  });

  afterAll(async () => {
    if (client) {
      // 自洁（2026-09-14 lab_dev/lab_test 残留 lab_smoke 清理）：既然 DROP/CREATE
      // 都不碰 public，测完同样把隔离 schema 摘掉，不给目标库留残渣。
      try { await client.query(`DROP SCHEMA IF EXISTS "${SMOKE_SCHEMA}" CASCADE`); } catch {}
      try { await client.end(); } catch {}
    }
  });

  it("connects and selects 1", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT 1 AS ok");
    expect(rows[0]?.ok).toBe(1);
  });

  it("pg devDep 可加载 + 借链联目标库（require('pg') + SELECT 1）", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT current_database() AS db");
    // CI 默认 lab_test,本地默认 lab_dev。两条路径都验「能 SELECT」即可,不绑 DB 名
    const dbName = rows[0]?.db as string | undefined;
    expect(typeof dbName).toBe("string");
    expect(dbName?.length ?? 0).toBeGreaterThan(0);
  });

  it("借链与 shared drizzle.replay.test.ts 同款（createRequire 本仓 package.json 解析 pg）", () => {
    // 本文件顶部的 pgModule 加载就是 shared tests/drizzle.replay.test.ts 的同款路径：
    // createRequire(本仓 package.json) → require("pg") 命中本仓 devDependencies
    expect(pgModule).not.toBeNull();
    expect(typeof pgModule!.Client).toBe("function");
  });

  it("has the 24 target tables after applying shared target DDL", async () => {
    if (!client) return;
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SMOKE_SCHEMA],
    );
    expect(rows.length).toBe(EXPECTED_TABLES);
  });

  it("tenant_id column exists on ≥1 table", async () => {
    if (!client) return;
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND column_name='tenant_id' LIMIT 1`,
      [SMOKE_SCHEMA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
