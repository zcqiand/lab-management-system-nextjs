// GET    /api/report-names/:code → InspectionReportName | 404
// PUT    /api/report-names/:code → InspectionReportName（updatedAt 重写）
// DELETE /api/report-names/:code → 204

import { NextRequest } from "next/server";
import { inspectionReportNames, getReportName } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = getReportName(params.code);
  if (!r) return notFound("ReportName not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const r = getReportName(params.code);
  if (!r) return notFound("ReportName not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { code: r.code, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const i = inspectionReportNames.findIndex((r) => r.code === params.code);
  if (i < 0) return notFound("ReportName not found");
  inspectionReportNames.splice(i, 1);
  return noContent();
}
