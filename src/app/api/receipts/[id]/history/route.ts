// GET /api/receipts/:id/history → FlowHistoryEntry[]（裸数组，msw handler 同款）

import { NextRequest } from "next/server";
import { findReceipt, notFound } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = findReceipt(params.id);
  if (!r) return notFound("Receipt not found");
  return Response.json(r.flowHistory ?? []);
}
