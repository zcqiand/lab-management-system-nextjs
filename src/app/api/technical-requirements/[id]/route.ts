// M04.F05 技术要求 PUT/DELETE /:id —— 派生 id 反查复合键行原地写。
// T11(2026-09-16)：数据源走 fixtures-runtime 的 globalThis 单例（跨路由 bundle 共享）。

import { NextRequest } from "next/server";
import { techReqArr, techReqId } from "@/lib/fixtures-runtime";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(id: string): Record<string, unknown> | undefined {
  return techReqArr().find((r) => techReqId(r) === id);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("TechnicalRequirement not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, { updatedAt: NOW() });
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const arr = techReqArr();
  const i = arr.findIndex((r) => techReqId(r) === params.id);
  if (i < 0) return notFound("TechnicalRequirement not found");
  arr.splice(i, 1);
  return noContent();
}
