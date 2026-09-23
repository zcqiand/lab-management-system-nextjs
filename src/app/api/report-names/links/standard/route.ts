// M06.F07 报告名称↔判定/检测标准 link/unlink。
// GET    /api/report-names/links/standard?reportNameCode=&role= → {items,total}
// POST   /api/report-names/links/standard → 204（upsert 幂等）
// DELETE /api/report-names/links/standard?reportNameCode=&inspectionStandardCode=&role= → 204
//
// 数据源：lab_dev.inspection_report_name_standards（T11 fixtures→PG；契约面不变）。

import { NextRequest, NextResponse } from "next/server";
import { wrapLinks, noContent } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";
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
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    return wrapLinks(await listReportNameLinksDb("standard"), req, {
      reportNameCode: "reportNameCode",
      inspectionStandardCode: "inspectionStandardCode",
      role: "role",
    });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  try {
    if (body) await createReportNameLinkDb("standard", body as Record<string, unknown>);
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await deleteReportNameLinkDb("standard", req.nextUrl.searchParams);
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
