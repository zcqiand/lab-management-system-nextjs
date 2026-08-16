// GET /api/receipts/:id/history → FlowHistoryEntry[]（裸数组，msw handler 同款）
//
// 数据源：lab_dev.sample_receipts.flow_history jsonb（Task 6 接线）。

import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/api-helpers";
import { getReceiptDb, isDbUnavailable } from "@/lib/db-queries";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await getReceiptDb(params.id);
    if (!r) return notFound("Receipt not found");
    return Response.json(r.flowHistory ?? []);
  } catch (e) {
    if (isDbUnavailable(e))
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    throw e;
  }
}
