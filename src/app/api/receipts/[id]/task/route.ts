// PUT /api/receipts/:id/task — M03.F02 任务分配/取消（assigneeId/assigneeName/plannedTestDate）
//
// 数据源：lab_dev.sample_receipts（Task 6 接线）。putReceiptDb 子集：
// 只把 assignee_id/assignee_name/planned_test_date 三列 patch 进去（+ updatedAt 重写），
// body 其它键忽略（msw 版 Object.assign 会带上，但任务分配语义只有这三列）。

import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/api-helpers";
import { putReceiptDb, isDbUnavailable } from "@/lib/db-queries";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as {
    assigneeId?: string;
    assigneeName?: string;
    plannedTestDate?: string;
  };
  const patch: Record<string, unknown> = {};
  if ("assigneeId" in body) patch.assigneeId = body.assigneeId;
  if ("assigneeName" in body) patch.assigneeName = body.assigneeName;
  if ("plannedTestDate" in body) patch.plannedTestDate = body.plannedTestDate;
  try {
    const r = await putReceiptDb(params.id, patch);
    if (!r) return notFound("Receipt not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e))
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    throw e;
  }
}
