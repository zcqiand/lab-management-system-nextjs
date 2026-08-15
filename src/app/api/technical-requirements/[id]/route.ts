// M04.F05 技术要求 PUT/DELETE /:id —— 派生 id 反查复合键行原地写。

import { NextRequest } from "next/server";
import { technicalRequirements } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

function findRow(id: string): Record<string, unknown> | undefined {
  return (technicalRequirements as unknown as Record<string, unknown>[]).find(
    (r) =>
      String(
        r["id"] ??
          `tr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}-${r["judgmentStandardCode"]}`,
      ) === id,
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const row = findRow(params.id);
  if (!row) return notFound("TechnicalRequirement not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, { updatedAt: NOW() });
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const arr = technicalRequirements as unknown as Record<string, unknown>[];
  const i = arr.findIndex(
    (r) =>
      String(
        r["id"] ??
          `tr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}-${r["judgmentStandardCode"]}`,
      ) === params.id,
  );
  if (i < 0) return notFound("TechnicalRequirement not found");
  arr.splice(i, 1);
  return noContent();
}
