// M03.F03.I11 人工改判：PATCH /api/test-records/:id/verdict {verdict}
// token 化（2026-09-23 P3）：他租户记录 = 404 not-found 语义

import { NextRequest, NextResponse } from "next/server";
import { getTestRecord } from "@lab/management-system-msw/fixtures";
import { notFound, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const t = getTestRecord(params.id);
  if (!t || t.tenantId !== auth.tenantId) return notFound("TestRecord not found");
  const body = (await req.json().catch(() => ({}))) as { verdict?: string };
  Object.assign(t, { verdict: String(body.verdict ?? ""), updatedAt: NOW() });
  return Response.json(t);
}
