// M06 项目↔参数 link/unlink。
// GET    /api/inspection/links/object-parameter?inspectionObjectCode=&inspectionParameterCode= → {items,total}
// POST   → 204；DELETE 同款 query 键 → 204

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { inspectionObjectParameters } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return wrapLinks(
    inspectionObjectParameters as unknown as Record<string, unknown>[],
    req,
    {
      inspectionObjectCode: "inspectionObjectCode",
      inspectionParameterCode: "inspectionParameterCode",
    },
  );
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (body) inspectionObjectParameters.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return linkDelete(
    req,
    inspectionObjectParameters as unknown as Record<string, unknown>[],
  );
}
