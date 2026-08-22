// DB smoke test：借 pg + 跑 shared/migrations + select 1 + count information_schema.tables。
//
// 镜像 saas-identity-platform-nextjs/tests/db.smoke.test.ts：
//   1) 直接 require("pg")（来自本仓 devDep，由 shared/sync-db.mjs 同样路径借）
//   2) 用同款借链 reach shared 的 V*.sql，按字典序执行
//   3) 校验四点：SELECT 1 / 12 V 都跑了 / ≥24 张表 / tenant_id 列存在（V012 emit）
//
// 跳过条件：pg 未装。
// 这条测试**本身就是 infra 验收证据之一**——如果它跑通，shared/sync-db.mjs 借链也通。
//
// Schema 选择：用独立 schema `lab_smoke` 而非 `public`，避免 DROP/CREATE 公共 schema
// 时把 seed-db 灌好的业务数据销毁（receipts-pg 等测试需要 public schema 已有数据才能跑）。
// 2026-08-16 修复：原版每次跑都 DROP SCHEMA public CASCADE + replay，同 vitest session
// 里后跑的 PG 测试因 schema 空而全炸；改用 lab_smoke 隔离后 smoke 自洁，public 不动。
//
// M97 fnTest 挂载：F01.I01（replay 语义）+ F02.I01/I02/I03（pg devDep / 借链可达 /
// 被 shared sync-db 消费的同款路径）。

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fnTest } from "./fn";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SHARED_SQL_DIR = resolve(ROOT, "../lab-management-system-shared/sql/migrations");

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
  // pg 没装时跳过（与 saas smoke 同款策略）
}

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev";
const SMOKE_SCHEMA = "lab_smoke";

describe("DB smoke (PG)", () => {
  if (!pgModule) {
    it.skip("pg 未装；请 npm install", () => {});
    return;
  }

  let client: PgClient | null = null;
  let appliedCount = 0;

  beforeAll(async () => {
    client = new pgModule.Client({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();

    // 跑 shared V*.sql（按字典序）。emit-schema.mjs 同款逻辑。
    let files: string[] = [];
    try {
      files = readdirSync(SHARED_SQL_DIR)
        .filter((f) => /^V\d+__.+\.sql$/.test(f))
        .sort();
    } catch {
      return;
    }

    // 用独立 schema 隔离（见文件头注释）。DROP/CREATE lab_smoke 不影响 public。
    await client.query(`DROP SCHEMA IF EXISTS "${SMOKE_SCHEMA}" CASCADE`);
    await client.query(`CREATE SCHEMA "${SMOKE_SCHEMA}"`);
    await client.query(`SET search_path TO "${SMOKE_SCHEMA}"`);

    for (const f of files) {
      const sql = readFileSync(resolve(SHARED_SQL_DIR, f), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        appliedCount++;
      } catch (e) {
        await client.query("ROLLBACK");
        // 真迁移中途失败 → abort（与 emit-schema.mjs 一致）
        throw e;
      }
    }
  });

  afterAll(async () => {
    if (client) {
      try { await client.end(); } catch {}
    }
  });

  it("connects and selects 1", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT 1 AS ok");
    expect(rows[0]?.ok).toBe(1);
  });

  fnTest(["M97.F02.I01", "M97.F02.I02"], "pg devDep 可加载 + 借链联目标库（require('pg') + SELECT 1）", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT current_database() AS db");
    // CI 默认 lab_test,本地默认 lab_dev。两条路径都验「能 SELECT」即可,不绑 DB 名
    const dbName = rows[0]?.db as string | undefined;
    expect(typeof dbName).toBe("string");
    expect(dbName?.length ?? 0).toBeGreaterThan(0);
  });

  fnTest(["M97.F02.I03"], "借链与 shared sync-db.mjs 同款（createRequire 本仓 package.json 解析 pg）", () => {
    // 本文件顶部的 pgModule 加载就是 sync-db.mjs:36-46 同款路径：
    // createRequire(本仓 package.json) → require("pg") 命中本仓 devDependencies
    expect(pgModule).not.toBeNull();
    expect(typeof pgModule!.Client).toBe("function");
  });

  fnTest(["M97.F01.I01"], "replay shared V*.sql 全量成功（每条一事务，中途失败即 abort）", () => {
    expect(appliedCount).toBeGreaterThanOrEqual(12);
  });

  it("has ≥24 tables after migrations", async () => {
    if (!client) return;
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SMOKE_SCHEMA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(24);
  });

  it("tenant_id column exists on ≥1 table (V012 emit)", async () => {
    if (!client) return;
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND column_name='tenant_id' LIMIT 1`,
      [SMOKE_SCHEMA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
