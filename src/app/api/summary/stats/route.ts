// GET /api/summary/stats → 工作台统计（lab-msw summaryExtraHandlers 同款形状）

import { NextResponse } from "next/server";
import { sampleReceipts, samples, TENANT } from "@/lib/api-helpers";
import { contracts } from "@lab/management-system-msw/fixtures";

export async function GET() {
  const rows = sampleReceipts.filter((r) => r.tenantId === TENANT);
  const byStatus = (s: string) => rows.filter((r) => r.flowStatus === s).length;
  return NextResponse.json({
    contractCount: contracts.length,
    receiptCount: rows.length,
    sampleCount: samples.length,
    reportCountByStatus: {
      draft: byStatus("receiving") + byStatus("task_assignment") + byStatus("data_entry"),
      reviewing: byStatus("review") + byStatus("approval"),
      issued: byStatus("issuance") + byStatus("archived") + byStatus("completed"),
    },
    pendingTaskCount: byStatus("task_assignment") + byStatus("data_entry") + byStatus("review"),
  });
}
