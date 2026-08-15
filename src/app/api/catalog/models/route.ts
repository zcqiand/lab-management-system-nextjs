// M04.F06 型号维护（catalog 同构 4 表之一）。
// GET /api/catalog/models?inspectionObjectCode= → {items,total}；POST → 201

import { NextRequest } from "next/server";
import { catalogGet, catalogPost } from "@/lib/catalog-handlers";
import { inspectionModels } from "@lab/management-system-msw/fixtures";

export async function GET(req: NextRequest) {
  return catalogGet(inspectionModels as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  return catalogPost(inspectionModels as unknown as Record<string, unknown>[], req);
}
