// M04.F09 牌号维护：PUT/DELETE /api/catalog/brands/:code
//
// 数据源：lab_test.inspection_brands（src/lib/db-queries.ts CATALOG_CFGS；Batch1 接真库）。
// token 化（2026-09-23）：DB 版本按 token 租户过滤（catalog-handlers requireTenant）。

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { CATALOG_CFGS } from "@/lib/db-queries";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(CATALOG_CFGS.brands, req, params.code);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  return catalogDelete(CATALOG_CFGS.brands, req, params.code);
}
