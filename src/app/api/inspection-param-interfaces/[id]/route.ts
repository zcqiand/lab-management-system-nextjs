// M06.F08 参数界面：GET/PUT/DELETE /api/inspection-param-interfaces/:id（id 或 code 皆可命中；
// DELETE 内置（isOfficial）不可删 400——REF 语义）

import { NextRequest } from "next/server";
import { inspectionParamInterfaces } from "@lab/management-system-msw/fixtures";
import { notFound, badRequest, noContent, NOW } from "@/lib/api-helpers";

function findRow(id: string): Record<string, unknown> | undefined {
  return (inspectionParamInterfaces as unknown as Record<string, unknown>[]).find(
    (r) => r["id"] === id || r["code"] === id,
  );
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("InspectionParamInterface not found");
  return Response.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("InspectionParamInterface not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, { updatedAt: NOW() });
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const arr = inspectionParamInterfaces as unknown as Record<string, unknown>[];
  const i = arr.findIndex((r) => r["id"] === params.id || r["code"] === params.id);
  if (i < 0) return notFound("参数界面不存在");
  if (arr[i]!["isOfficial"]) return badRequest("内置模型不可删除");
  arr.splice(i, 1);
  return noContent();
}
