// M04.F05 技术要求复合主键三端点 ——
// GET/PUT/DELETE /api/technical-requirements/{object}/{parameter}/{judgmentStandard}。
//
// T11(2026-09-16)：此前本路径无路由，请求落到 app/(console)/[...path] catch-all
// 返 200 HTML —— 四方比对「不存在三段路径 → 404」红 + 三元组 PUT/DELETE 写路径全空。
//
// 目录名沿用 [id]/[parameter]/[standard]：Next.js 禁止同层出现两种动态 slug 名，
// 单段 [id]（派生 id 反查）已占用第一段槽位，故三段路径第一段复用 [id] 目录名 ——
// 语义上它是 inspectionObjectCode。数据源与 list / 单段 [id] 路由同源：
// fixtures-runtime 的 globalThis 单例（跨路由 bundle 共享）。

import { NextRequest, NextResponse } from "next/server";
import { techReqArr, techReqId, type FixtureRow } from "@/lib/fixtures-runtime";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(
  objectCode: string,
  parameterCode: string,
  standardCode: string,
): FixtureRow | undefined {
  return techReqArr().find(
    (r) =>
      String(r["inspectionObjectCode"] ?? "") === objectCode &&
      String(r["inspectionParameterCode"] ?? "") === parameterCode &&
      String(r["judgmentStandardCode"] ?? "") === standardCode,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; parameter: string; standard: string } },
) {
  const row = findRow(params.id, params.parameter, params.standard);
  if (!row) return notFound("TechnicalRequirement not found");
  return NextResponse.json({ ...row, id: techReqId(row) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; parameter: string; standard: string } },
) {
  const row = findRow(params.id, params.parameter, params.standard);
  if (!row) return notFound("TechnicalRequirement not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, {
    updatedAt: NOW(),
  });
  return NextResponse.json({ ...row, id: techReqId(row) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; parameter: string; standard: string } },
) {
  const arr = techReqArr();
  const i = arr.findIndex(
    (r) =>
      String(r["inspectionObjectCode"] ?? "") === params.id &&
      String(r["inspectionParameterCode"] ?? "") === params.parameter &&
      String(r["judgmentStandardCode"] ?? "") === params.standard,
  );
  if (i < 0) return notFound("TechnicalRequirement not found");
  arr.splice(i, 1);
  return noContent();
}
