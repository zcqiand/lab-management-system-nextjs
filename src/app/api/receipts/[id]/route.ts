// GET    /api/receipts/:id  → SampleReceipt | 404
// PUT    /api/receipts/:id  → SampleReceipt（updatedAt 重写；id/tenantId 不可覆写）
// DELETE /api/receipts/:id  → 204
//
// 数据源：lab_dev.sample_receipts（src/lib/db-queries.ts；Task 6 接线）。
// PUT 语义 = msw 版 Object.assign：body 键覆盖 + updatedAt 重写；
// 未知键（无对应列）静默丢弃。FK null 出库保持 null（不转回 ''）。

import { NextRequest, NextResponse } from "next/server";
import { notFound, noContent } from "@/lib/api-helpers";
import {
  getReceiptDb,
  putReceiptDb,
  deleteReceiptDb,
  isDbUnavailable,
} from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await getReceiptDb(params.id);
    if (!r) return notFound("Receipt not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = await putReceiptDb(params.id, body);
    if (!r) return notFound("Receipt not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteReceiptDb(params.id);
    if (!ok) return notFound("Receipt not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
