// M06.F05 计算方法复合主键三端点 —— GET/PUT/DELETE /api/calculation-methods/{object}/{parameter}。
//
// T11(2026-09-16)：此前本路径无路由，请求落到 app/(console)/[...path] catch-all
// 返 200 HTML —— 四方比对「不存在双段路径 → 404」红 + 复合键 PUT/DELETE 写路径全空。
//
// 目录名沿用 [id]/[parameter]：Next.js 禁止同层出现两种动态 slug 名（[id] 与
// [object] 同层会构建期冲突），单段 [id]（派生 id 反查）已占用第一段槽位，故
// 双段路径第一段复用 [id] 目录名 —— 语义上它是 inspectionObjectCode。
// 数据源与 list / 单段 [id] 路由同源：fixtures-runtime 的 globalThis 单例。

import { NextRequest, NextResponse } from "next/server";
import { calcMethodArr, calcMethodId, type FixtureRow } from "@/lib/fixtures-runtime";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(objectCode: string, parameterCode: string): FixtureRow | undefined {
  return calcMethodArr().find(
    (r) =>
      String(r["inspectionObjectCode"] ?? "") === objectCode &&
      String(r["inspectionParameterCode"] ?? "") === parameterCode,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; parameter: string } },
) {
  const row = findRow(params.id, params.parameter);
  if (!row) return notFound("CalculationMethod not found");
  return NextResponse.json({ ...row, id: calcMethodId(row) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; parameter: string } },
) {
  const row = findRow(params.id, params.parameter);
  if (!row) return notFound("CalculationMethod not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, {
    updatedAt: NOW(),
  });
  return NextResponse.json({ ...row, id: calcMethodId(row) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; parameter: string } },
) {
  const arr = calcMethodArr();
  const i = arr.findIndex(
    (r) =>
      String(r["inspectionObjectCode"] ?? "") === params.id &&
      String(r["inspectionParameterCode"] ?? "") === params.parameter,
  );
  if (i < 0) return notFound("CalculationMethod not found");
  arr.splice(i, 1);
  return noContent();
}
