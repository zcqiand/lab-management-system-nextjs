// M04.F09 牌号维护（catalog 同构 4 表之一）。
// GET /api/catalog/brands?inspectionObjectCode= → {items,total}；POST → 201

import { NextRequest } from "next/server";
import { catalogGet, catalogPost } from "@/lib/catalog-handlers";
import { inspectionBrands } from "@lab/management-system-msw/fixtures";

export async function GET(req: NextRequest) {
  return catalogGet(inspectionBrands as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  return catalogPost(inspectionBrands as unknown as Record<string, unknown>[], req);
}
