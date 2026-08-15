// M06.F07 报告名称 CRUD。
// GET  /api/report-names?keyword=&page=&pageSize= → {items,total}（REF 形状，wrapDict 补 id=code）
// POST /api/report-names → InspectionReportName（201）

import { NextRequest, NextResponse } from "next/server";
import { inspectionReportNames, getReportName } from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(inspectionReportNames as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  if (getReportName(code)) return badRequest("报告名称编码已存在");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  inspectionReportNames.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
