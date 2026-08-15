// M04.F07 规格维护（catalog 同构 4 表之一）。

import { NextRequest } from "next/server";
import { catalogGet, catalogPost } from "@/lib/catalog-handlers";
import { inspectionSpecs } from "@lab/management-system-msw/fixtures";

export async function GET(req: NextRequest) {
  return catalogGet(inspectionSpecs as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  return catalogPost(inspectionSpecs as unknown as Record<string, unknown>[], req);
}
