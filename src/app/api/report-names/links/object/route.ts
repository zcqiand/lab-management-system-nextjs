// M06.F07 报告名称↔检测项目 link/unlink。
// GET    /api/report-names/links/object?reportNameCode=&inspectionObjectCode= → {items,total}
// POST   /api/report-names/links/object → 204（upsert 幂等）
// DELETE /api/report-names/links/object?reportNameCode=&inspectionObjectCode= → 204（query 键匹配）
//
// 数据源：lab_dev.inspection_object_report_names（T11 fixtures→PG；契约面不变）。

import { NextRequest, NextResponse } from "next/server";
import { wrapLinks, noContent } from "@/lib/api-helpers";
import {
  listReportNameLinksDb,
  createReportNameLinkDb,
  deleteReportNameLinkDb,
  isDbUnavailable,
} from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  try {
    return wrapLinks(await listReportNameLinksDb("object"), req, {
      reportNameCode: "reportNameCode",
      inspectionObjectCode: "inspectionObjectCode",
    });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    if (body) await createReportNameLinkDb("object", body as Record<string, unknown>);
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await deleteReportNameLinkDb("object", req.nextUrl.searchParams);
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
