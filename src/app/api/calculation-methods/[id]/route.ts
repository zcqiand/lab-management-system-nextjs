// M06.F05 计算方法 PUT/DELETE /:id —— REF 组件以派生 id 调用，反查复合键行原地写。

import { NextRequest } from "next/server";
import { inspectionCalculationMethods } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(id: string): Record<string, unknown> | undefined {
  return (inspectionCalculationMethods as unknown as Record<string, unknown>[]).find(
    (r) =>
      String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`) === id,
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("CalculationMethod not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, { updatedAt: NOW() });
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const arr = inspectionCalculationMethods as unknown as Record<string, unknown>[];
  const i = arr.findIndex(
    (r) =>
      String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`) ===
      params.id,
  );
  if (i < 0) return notFound("CalculationMethod not found");
  arr.splice(i, 1);
  return noContent();
}
