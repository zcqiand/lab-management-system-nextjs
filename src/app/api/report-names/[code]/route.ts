// GET    /api/report-names/:code → InspectionReportName | 404
// PUT    /api/report-names/:code → InspectionReportName（updatedAt 重写）
// DELETE /api/report-names/:code → 204
//
// 数据源：lab_dev.inspection_report_names（T11 fixtures→PG；原内存 fixtures 版在
// nextjs dev recompile 下丢内存态，live gate 实证写入蒸发）。契约面不变。

import { NextRequest, NextResponse } from "next/server";
import { notFound, noContent, NOW } from "@/lib/api-helpers";
import {
  getReportNameDb,
  updateReportNameDb,
  deleteReportNameDb,
  isDbUnavailable,
} from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const r = await getReportNameDb(params.code);
    if (!r) return notFound("ReportName not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = await updateReportNameDb(params.code, { ...body, updatedAt: NOW() });
    if (!r) return notFound("ReportName not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const ok = await deleteReportNameDb(params.code);
    if (!ok) return notFound("ReportName not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
