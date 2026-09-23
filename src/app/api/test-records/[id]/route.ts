// M03.F03 检测记录：GET/PUT/DELETE /api/test-records/:id
// token 化（2026-09-23 P3）：按 token 租户匹配，他租户 id = 404 not-found 语义

import { NextRequest, NextResponse } from "next/server";
import { testRecords, getTestRecord } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const t = getTestRecord(params.id);
  if (!t || t.tenantId !== auth.tenantId) return notFound("TestRecord not found");
  return Response.json(t);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const t = getTestRecord(params.id);
  if (!t || t.tenantId !== auth.tenantId) return notFound("TestRecord not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(t, body, { id: t.id, updatedAt: NOW() });
  // tenantId 归属不可被 body 改写
  t.tenantId = auth.tenantId;
  return Response.json(t);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const i = testRecords.findIndex(
    (t) => t.id === params.id && t.tenantId === auth.tenantId,
  );
  if (i < 0) return notFound("TestRecord not found");
  testRecords.splice(i, 1);
  return noContent();
}
