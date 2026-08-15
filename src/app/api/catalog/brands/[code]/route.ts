// M04.F09 牌号维护：PUT/DELETE /api/catalog/brands/:code

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { inspectionBrands } from "@lab/management-system-msw/fixtures";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(inspectionBrands as unknown as Record<string, unknown>[], req, params.code);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  return catalogDelete(inspectionBrands as unknown as Record<string, unknown>[], params.code);
}
