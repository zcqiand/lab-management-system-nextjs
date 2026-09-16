// M06.F07 报告名称 CRUD。
// GET  /api/report-names?keyword=&page=&pageSize= → {items,total}（REF 形状，wrapDict 补 id=code）
// POST /api/report-names → InspectionReportName（201）
//
// 数据源：lab_dev.inspection_report_names（src/lib/db-queries.ts；T11 fixtures→PG）。
// 原内存 fixtures 版在 nextjs dev 的 recompile 下会丢内存态（live gate 实证
// POST 201 后 [code] 路由 404），正解=迁 PG，与 receipts 批次同款；契约面不变。

import { NextRequest, NextResponse } from "next/server";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";
import {
  listReportNamesDb,
  getReportNameDb,
  createReportNameDb,
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
    return wrapDict(await listReportNamesDb(), req);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  try {
    if (await getReportNameDb(code)) return badRequest("报告名称编码已存在");
    const row = await createReportNameDb({ createdAt: NOW(), updatedAt: NOW(), ...body });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
