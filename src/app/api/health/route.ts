import { NextResponse } from "next/server";

/**
 * Route Handler /api/health —— PG 连通性 sanity。
 *
 * 本仓无产品页面、health 是**唯一**会被 SSR 命中的 route，所以它兼任：
 *   1) 验证 src/db/ 的 pg server-only bundle 切分正确
 *   2) 验证 DATABASE_URL 已设置并可连到 lab_dev
 *   3) SSR 真给前端一个状态点（未来 react/vue 子模块对接时可复用）
 */

export async function GET() {
  try {
    const { Pool } = await import("pg");
    const url = process.env.DATABASE_URL;
    if (!url) {
      return NextResponse.json({ ok: false, error: "DATABASE_URL 未设置" }, { status: 500 });
    }
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
    const client = await pool.connect();
    try {
      const { rows } = await client.query("SELECT 1 AS ok, current_database() AS db");
      return NextResponse.json({ ok: true, db: rows[0]?.db });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
