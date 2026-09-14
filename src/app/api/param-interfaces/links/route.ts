// M06.F08 参数↔界面 link/unlink（契约路径，REQ-2026-001；字段名对齐契约
// ParamInterfaceLink：inspectionParameterCode + paramInterfaceCode）。
// GET    /api/param-interfaces/links?inspectionParameterCode=&paramInterfaceCode=&reportNameCode=
//        → {items,page,pageSize,total}
// POST   → 201（重复三元组 400）
// DELETE → 204（@body 语义；query 兼容过渡期）

import { NextRequest, NextResponse } from "next/server";
import { fixturesSingleton } from "@/lib/fixtures-runtime";

const inspectionParamInterfaceLinks = fixturesSingleton.inspectionParamInterfaceLinks;
import { pageOf, num, badRequest, NOW, qp, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const code = url.get("inspectionParameterCode");
  const pic = url.get("paramInterfaceCode");
  const rn = url.get("reportNameCode");
  let items = inspectionParamInterfaceLinks as unknown as Record<string, unknown>[];
  if (code) items = items.filter((l) => l["inspectionParameterCode"] === code);
  if (pic) items = items.filter((l) => l["paramInterfaceCode"] === pic);
  if (rn) items = items.filter((l) => (l["reportNameCode"] ?? undefined) === rn);
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length || 1)),
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body["inspectionParameterCode"] || !body["paramInterfaceCode"])
    return badRequest("inspectionParameterCode/paramInterfaceCode 必填");
  const arr = inspectionParamInterfaceLinks as unknown as Record<string, unknown>[];
  const dup = arr.some(
    (r) =>
      r["inspectionParameterCode"] === body["inspectionParameterCode"] &&
      r["paramInterfaceCode"] === body["paramInterfaceCode"] &&
      (r["reportNameCode"] ?? undefined) === (body["reportNameCode"] ?? undefined),
  );
  if (dup) return badRequest("关联已存在");
  const now = NOW();
  const row = {
    inspectionParameterCode: body["inspectionParameterCode"],
    paramInterfaceCode: body["paramInterfaceCode"],
    reportNameCode: body["reportNameCode"],
    config: body["config"],
    createdAt: now,
    updatedAt: now,
  };
  arr.push(row);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  // 契约 unlink 是 @body；query 兼容过渡期（AssociationManager 双发）
  const arr = inspectionParamInterfaceLinks as unknown as Record<string, unknown>[];
  let parameterCode = "";
  let interfaceCode = "";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    parameterCode = String(b["inspectionParameterCode"] ?? "");
    interfaceCode = String(b["paramInterfaceCode"] ?? "");
  } catch {
    const url = qp(req);
    parameterCode = url.get("inspectionParameterCode") ?? "";
    interfaceCode = url.get("paramInterfaceCode") ?? "";
  }
  const i = arr.findIndex(
    (l) => l["inspectionParameterCode"] === parameterCode && l["paramInterfaceCode"] === interfaceCode,
  );
  // 契约 unlink 对不存在的关联幂等返回 204（tsp: void | ErrorResponse，
  // REF linkDelete 语义 = 未命中也 204），保持与 msw/真后端一致
  if (i >= 0) arr.splice(i, 1);
  return noContent();
}
