// M04.F06 型号维护：PUT/DELETE /api/catalog/models/:code
//
// 数据源：lab_test.inspection_models（src/lib/db-queries.ts CATALOG_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；DB 版本按 TENANT-001 隔离（种子行全部 TENANT-001，安全）。

import { NextRequest } from "next/server";
import { catalogPut, catalogDelete } from "@/lib/catalog-handlers";
import { CATALOG_CFGS } from "@/lib/db-queries";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  return catalogPut(CATALOG_CFGS.models, req, params.code);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  return catalogDelete(CATALOG_CFGS.models, params.code);
}
