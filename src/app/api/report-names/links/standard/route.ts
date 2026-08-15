// M06.F07 报告名称↔判定/检测标准 link/unlink。
// GET    /api/report-names/links/standard?reportNameCode=&role= → {items,total}
// POST   /api/report-names/links/standard → 204
// DELETE /api/report-names/links/standard?reportNameCode=&inspectionStandardCode=&role= → 204

import { NextRequest } from "next/server";
import { inspectionReportNameStandards } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(inspectionReportNameStandards as unknown as Record<string, unknown>[], req, {
    reportNameCode: "reportNameCode",
    inspectionStandardCode: "inspectionStandardCode",
    role: "role",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body) inspectionReportNameStandards.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, inspectionReportNameStandards as unknown as Record<string, unknown>[]);
}
