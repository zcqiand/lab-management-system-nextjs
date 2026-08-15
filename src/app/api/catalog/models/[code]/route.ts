// M04.F06 型号维护：PUT/DELETE /api/catalog/models/:code

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { inspectionModels } from "@lab/management-system-msw/fixtures";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(inspectionModels as unknown as Record<string, unknown>[], req, params.code);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  return catalogDelete(inspectionModels as unknown as Record<string, unknown>[], params.code);
}
