// GET /api/receipts/flow/queue?stage=&page=&pageSize= → {items,page,pageSize,total}

import { NextRequest, NextResponse } from "next/server";
import { sampleReceipts, pageOf, qp, num, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const stage = url.get("stage");
  let items = sampleReceipts.filter((r) => r.tenantId === TENANT);
  if (stage) items = items.filter((r) => r.flowStatus === stage);
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}
