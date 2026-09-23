// M04.F07 规格维护（catalog 同构 4 表之一）。
// GET /api/catalog/specs?inspectionObjectCode= → {items,page,pageSize,total}（id=code 补列）
// POST /api/catalog/specs → 201
//
// 数据源：lab_test.inspection_specs（src/lib/db-queries.ts CATALOG_CFGS；Batch1 接真库）。
// token 化（2026-09-23）：DB 版本按 token 租户过滤（catalog-handlers requireTenant）。

import { NextRequest } from "next/server";
import { catalogGet, catalogPost } from "@/lib/catalog-handlers";
import { CATALOG_CFGS } from "@/lib/db-queries";

export async function GET(req: NextRequest) {
  return catalogGet(CATALOG_CFGS.specs, req);
}

export async function POST(req: NextRequest) {
  return catalogPost(CATALOG_CFGS.specs, req);
}
