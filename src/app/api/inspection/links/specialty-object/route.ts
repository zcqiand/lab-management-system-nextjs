// M06 专项↔项目 link/unlink。
// GET    /api/inspection/links/specialty-object?inspectionSpecialtyCode= → {items,total}
// POST   → 204；DELETE ?inspectionSpecialtyCode=&inspectionObjectCode= → 204

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { inspectionSpecialtyObjects } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return wrapLinks(
    inspectionSpecialtyObjects as unknown as Record<string, unknown>[],
    req,
    {
      inspectionSpecialtyCode: "inspectionSpecialtyCode",
    },
  );
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (body) inspectionSpecialtyObjects.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return linkDelete(
    req,
    inspectionSpecialtyObjects as unknown as Record<string, unknown>[],
  );
}
