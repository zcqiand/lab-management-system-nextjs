// M04.F05 技术要求（复合主键 object+parameter+judgmentStandard）。
// GET  /api/technical-requirements?inspectionObjectCode=&inspectionParameterCode=&judgmentStandardCode=
//      → {items,page,pageSize,total}（行补 id=tr-<obj>-<param>-<std>）
// POST /api/technical-requirements → 201

import { NextRequest, NextResponse } from "next/server";
import { technicalRequirements } from "@lab/management-system-msw/fixtures";
import { pageOf, qp, num, NOW } from "@/lib/api-helpers";

export function techReqId(r: Record<string, unknown>): string {
  return String(
    r["id"] ??
      `tr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}-${r["judgmentStandardCode"]}`,
  );
}

export async function GET(req: NextRequest) {
  const url = qp(req);
  const obj = url.get("inspectionObjectCode");
  const param = url.get("inspectionParameterCode");
  const std = url.get("judgmentStandardCode");
  let items = (technicalRequirements as unknown as Record<string, unknown>[]).map(
    (r): Record<string, unknown> => ({ ...r, id: techReqId(r) }),
  );
  if (obj) items = items.filter((r) => r["inspectionObjectCode"] === obj);
  if (param) items = items.filter((r) => r["inspectionParameterCode"] === param);
  if (std) items = items.filter((r) => r["judgmentStandardCode"] === std);
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
  entry["id"] = techReqId(entry);
  technicalRequirements.push(entry as never);
  return NextResponse.json(entry, { status: 201 });
}
