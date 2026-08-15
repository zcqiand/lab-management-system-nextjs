// M06.F07 报告名称↔检测项目 link/unlink。
// GET    /api/report-names/links/object?reportNameCode=&inspectionObjectCode= → {items,total}
// POST   /api/report-names/links/object → 204（body 裸 push）
// DELETE /api/report-names/links/object?reportNameCode=&inspectionObjectCode= → 204（query 键匹配）

import { NextRequest } from "next/server";
import { inspectionObjectReportNames } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(inspectionObjectReportNames as unknown as Record<string, unknown>[], req, {
    reportNameCode: "reportNameCode",
    inspectionObjectCode: "inspectionObjectCode",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body) inspectionObjectReportNames.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, inspectionObjectReportNames as unknown as Record<string, unknown>[]);
}
