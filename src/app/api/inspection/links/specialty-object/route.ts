// M06 专项↔项目 link/unlink。
// GET    /api/inspection/links/specialty-object?inspectionSpecialtyCode= → {items,total}
// POST   → 204；DELETE ?inspectionSpecialtyCode=&inspectionObjectCode= → 204

import { NextRequest } from "next/server";
import { inspectionSpecialtyObjects } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(inspectionSpecialtyObjects as unknown as Record<string, unknown>[], req, {
    inspectionSpecialtyCode: "inspectionSpecialtyCode",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body) inspectionSpecialtyObjects.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, inspectionSpecialtyObjects as unknown as Record<string, unknown>[]);
}
