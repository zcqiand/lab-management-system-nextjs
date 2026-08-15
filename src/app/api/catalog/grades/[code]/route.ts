// M04.F08 等级维护：PUT/DELETE /api/catalog/grades/:code

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { inspectionGrades } from "@lab/management-system-msw/fixtures";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(inspectionGrades as unknown as Record<string, unknown>[], req, params.code);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  return catalogDelete(inspectionGrades as unknown as Record<string, unknown>[], params.code);
}
