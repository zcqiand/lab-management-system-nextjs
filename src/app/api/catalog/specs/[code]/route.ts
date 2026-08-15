// M04.F07 规格维护：PUT/DELETE /api/catalog/specs/:code

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { inspectionSpecs } from "@lab/management-system-msw/fixtures";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(inspectionSpecs as unknown as Record<string, unknown>[], req, params.code);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  return catalogDelete(inspectionSpecs as unknown as Record<string, unknown>[], params.code);
}
