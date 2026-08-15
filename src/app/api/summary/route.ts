// M05.F01 报告汇总。
// GET /api/summary?categoryCode=<RN|ALL> → {summaryName, columns, rows}
// （形状与 lab-msw summaryExtraHandlers 一致；SummaryPage 直读 columns+rows）

import { NextRequest, NextResponse } from "next/server";
import { sampleReceipts, contracts } from "@lab/management-system-msw/fixtures";
import { samples, qp, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const categoryCode = qp(req).get("categoryCode") ?? "ALL";
  const items =
    categoryCode === "ALL"
      ? sampleReceipts.filter((r) => r.tenantId === TENANT)
      : sampleReceipts.filter((r) => r.tenantId === TENANT && r.categoryCode === categoryCode);
  return NextResponse.json({
    summaryName: `报告汇总（${categoryCode}）`,
    columns: [
      { key: "commissionCode", label: "委托编号" },
      { key: "categoryCode", label: "报告类别" },
      { key: "projectName", label: "工程名称" },
      { key: "flowStatus", label: "流程状态" },
      { key: "result", label: "结论" },
      { key: "reportCode", label: "报告编号" },
    ],
    rows: items.map((r) => {
      const rec = r as {
        commissionCode: string;
        categoryCode: string;
        projectName?: string;
        flowStatus: string;
        result?: string;
        reportCode?: string;
      };
      return {
        commissionCode: rec.commissionCode,
        categoryCode: rec.categoryCode,
        projectName: rec.projectName ?? "",
        flowStatus: rec.flowStatus,
        result: rec.result ?? "",
        reportCode: rec.reportCode ?? "",
      };
    }),
  });
}

void contracts;
void samples;
