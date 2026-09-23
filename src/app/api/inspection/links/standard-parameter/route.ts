// M06 标准↔参数 link/unlink。
// GET    /api/inspection/links/standard-parameter?standardCode= → {items,total}
//        （msw handler 同款 standardCode 参数；兼容 inspectionStandardCode 全名）
// POST   → 204；DELETE ?inspectionStandardCode=&inspectionParameterCode= → 204

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { inspectionStandardParameters } from "@lab/management-system-msw/fixtures";
import { wrapLinks, linkDelete, noContent } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return wrapLinks(
    inspectionStandardParameters as unknown as Record<string, unknown>[],
    req,
    {
      standardCode: "inspectionStandardCode",
      inspectionStandardCode: "inspectionStandardCode",
      inspectionParameterCode: "inspectionParameterCode",
    },
  );
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (body) inspectionStandardParameters.push(body as never);
  return noContent();
}

export async function DELETE(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  return linkDelete(
    req,
    inspectionStandardParameters as unknown as Record<string, unknown>[],
  );
}
