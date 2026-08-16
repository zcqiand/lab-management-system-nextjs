// GET /api/receipts/flow/queue?stage=&page=&pageSize= → {items,page,pageSize,total}
//
// 数据源：lab_dev.sample_receipts（listReceiptsDb({flowStatus:stage})；Task 6 接线）。

import { NextRequest, NextResponse } from "next/server";
import { qp, num } from "@/lib/api-helpers";
import { listReceiptsDb, isDbUnavailable } from "@/lib/db-queries";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const stage = url.get("stage");
  try {
    const data = await listReceiptsDb({
      flowStatus: stage ?? undefined,
      keyword: "",
      page: num(url.get("page"), 1),
      pageSize: num(url.get("pageSize"), 20),
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isDbUnavailable(e))
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    throw e;
  }
}
