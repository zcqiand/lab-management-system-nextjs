// M04.F08 等级维护（catalog 同构 4 表之一）。
// GET /api/catalog/grades?inspectionObjectCode= → {items,total}；POST → 201

import { NextRequest } from "next/server";
import { catalogGet, catalogPost } from "@/lib/catalog-handlers";
import { inspectionGrades } from "@lab/management-system-msw/fixtures";

export async function GET(req: NextRequest) {
  return catalogGet(inspectionGrades as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  return catalogPost(inspectionGrades as unknown as Record<string, unknown>[], req);
}
