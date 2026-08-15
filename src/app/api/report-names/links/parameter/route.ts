// M06.F07 报告名称↔检测参数 link/unlink。
// GET    /api/report-names/links/parameter?reportNameCode= → {items,total}
// POST   /api/report-names/links/parameter → 204
// DELETE /api/report-names/links/parameter?reportNameCode=&inspectionParameterCode= → 204

import { NextRequest } from "next/server";
import { inspectionReportNameParameters } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(inspectionReportNameParameters as unknown as Record<string, unknown>[], req, {
    reportNameCode: "reportNameCode",
    inspectionParameterCode: "inspectionParameterCode",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body) inspectionReportNameParameters.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, inspectionReportNameParameters as unknown as Record<string, unknown>[]);
}
