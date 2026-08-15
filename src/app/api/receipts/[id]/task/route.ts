// PUT /api/receipts/:id/task — M03.F02 任务分配/取消（assigneeId/assigneeName/plannedTestDate）

import { NextRequest } from "next/server";
import { findReceipt, notFound, NOW } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const r = findReceipt(params.id);
  if (!r) return notFound("Receipt not found");
  const body = (await req.json().catch(() => ({}))) as {
    assigneeId?: string;
    assigneeName?: string;
    plannedTestDate?: string;
  };
  Object.assign(r, body, { updatedAt: NOW() });
  return Response.json(r);
}
