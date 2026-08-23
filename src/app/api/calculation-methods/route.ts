// M06.F05 计算方法（复合主键 object+parameter；REF 组件以派生 id 调 /:id）。
// GET  /api/calculation-methods?inspectionObjectCode=&inspectionParameterCode=&testingStandardCode=
//      → {items,page,pageSize,total}（行补 id=cr-<obj>-<param>）
// POST /api/calculation-methods → 201

import { NextRequest, NextResponse } from "next/server";
import { inspectionCalculationMethods } from "@lab/management-system-msw/fixtures";
import { pageOf, qp, num, NOW } from "@/lib/api-helpers";

export function ruleId(r: Record<string, unknown>): string {
  return String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`);
}

export async function GET(req: NextRequest) {
  const url = qp(req);
  const obj = url.get("inspectionObjectCode");
  const param = url.get("inspectionParameterCode");
  const std = url.get("testingStandardCode");
  let items = (inspectionCalculationMethods as unknown as Record<string, unknown>[]).map(
    (r): Record<string, unknown> => ({ ...r, id: ruleId(r) }),
  );
  if (obj) items = items.filter((r) => r["inspectionObjectCode"] === obj);
  if (param) items = items.filter((r) => r["inspectionParameterCode"] === param);
  if (std) items = items.filter((r) => r["testingStandardCode"] === std);
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length || 1)),
  );
}

export async function POST(req: NextRequest) {
  const entry = {
    createdAt: NOW(),
    updatedAt: NOW(),
    ...((await req.json().catch(() => ({}))) as object),
  } as Record<string, unknown>;
  entry["id"] = ruleId(entry);
  inspectionCalculationMethods.push(entry as never);
  return NextResponse.json(entry, { status: 201 });
}
