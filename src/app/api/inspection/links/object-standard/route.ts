// M06 项目↔标准 link/unlink。
// GET    /api/inspection/links/object-standard?inspectionObjectCode=&role= → {items,total}
// POST   → 204；DELETE ?inspectionObjectCode=&inspectionStandardCode=&role= → 204

import { NextRequest } from "next/server";
import { inspectionObjectStandards } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapLinks(inspectionObjectStandards as unknown as Record<string, unknown>[], req, {
    inspectionObjectCode: "inspectionObjectCode",
    role: "role",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body) inspectionObjectStandards.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  return linkDelete(req, inspectionObjectStandards as unknown as Record<string, unknown>[]);
}
