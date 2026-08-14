import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { healthCheck } from "@/db/schema";

/**
 * Route Handler：演示 src/db/ 的 server-only 资源被正确路由到 server bundle。
 * 不需要 'use server' / 'use client' —— route.ts 默认就在 server 上。
 *
 * 凡是涉及数据库 / 鉴权 / 文件系统的代码，按规范进这里：
 *   - GET  /api/projects             → 列表
 *   - POST /api/projects             → 创建
 *   - GET  /api/projects/[id]        → 详情
 *   - PATCH/PUT /api/projects/[id]   → 更新
 *   - DELETE /api/projects/[id]      → 删除
 * 即便表单用 server action 触发，列表/筛选等仍走 route handler，便于分享/缓存。
 *
 * Drizzle query API 风格：链式 builder + 类型推导，不再需要 `as { n: number }` 强转。
 */
export async function GET() {
  try {
    db.insert(healthCheck).values({ ok: 1 }).run();
    const row = db
      .select({ n: sql<number>`count(*)` })
      .from(healthCheck)
      .get();
    return NextResponse.json({ ok: true, count: Number(row?.n ?? 0) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
