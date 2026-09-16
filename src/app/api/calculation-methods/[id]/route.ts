// M06.F05 计算方法 PUT/DELETE /:id —— REF 组件以派生 id 调用，反查复合键行原地写。
// T11(2026-09-16)：数据源走 fixtures-runtime 的 globalThis 单例（跨路由 bundle 共享）。

import { NextRequest } from "next/server";
import { calcMethodArr, calcMethodId } from "@/lib/fixtures-runtime";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(id: string): Record<string, unknown> | undefined {
  return calcMethodArr().find((r) => calcMethodId(r) === id);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("CalculationMethod not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, { updatedAt: NOW() });
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const arr = calcMethodArr();
  const i = arr.findIndex((r) => calcMethodId(r) === params.id);
  if (i < 0) return notFound("CalculationMethod not found");
  arr.splice(i, 1);
  return noContent();
}
