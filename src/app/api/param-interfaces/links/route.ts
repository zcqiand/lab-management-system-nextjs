// M06.F08 参数界面↔参数 link/unlink（REF 语义版：确定性 id + 重复 400 + 201）。
// GET    /api/param-interfaces/links?parameterCode=&paramInterfaceCode=&reportNameCode= → {items,total}
// POST   → 201；DELETE ?inspectionParameterCode=&paramInterfaceCode= → 204

import { NextRequest, NextResponse } from "next/server";
import { paramInterfaceLinks } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(paramInterfaceLinks as unknown as Record<string, unknown>[], req, {
    parameterCode: "inspectionParameterCode",
    paramCode: "inspectionParameterCode",
    paramInterfaceCode: "paramInterfaceCode",
    reportNameCode: "reportNameCode",
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body["inspectionParameterCode"] || !body["paramInterfaceCode"])
    return badRequest("inspectionParameterCode/paramInterfaceCode 必填");
  const id = body["reportNameCode"]
    ? `pi-param-${String(body["paramInterfaceCode"])}-${String(body["inspectionParameterCode"])}-${String(body["reportNameCode"])}`
    : `pi-param-${String(body["paramInterfaceCode"])}-${String(body["inspectionParameterCode"])}`;
  const arr = paramInterfaceLinks as unknown as Record<string, unknown>[];
  if (arr.some((r) => r["id"] === id)) return badRequest("关联已存在");
  const now = NOW();
  const row = {
    id,
    inspectionParameterCode: body["inspectionParameterCode"],
    paramInterfaceCode: body["paramInterfaceCode"],
    reportNameCode: body["reportNameCode"],
    createdAt: now,
    updatedAt: now,
  };
  arr.push(row as never);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, paramInterfaceLinks as unknown as Record<string, unknown>[]);
}
