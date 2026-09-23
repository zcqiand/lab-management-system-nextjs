// M03.F03 样品：GET/PUT/DELETE /api/samples/:id
// token 化（2026-09-23 P3）：按 token 租户匹配，他租户 id = 404 not-found 语义

import { NextRequest, NextResponse } from "next/server";
import { samples, getSample } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const s = getSample(params.id);
  if (!s || s.tenantId !== auth.tenantId) return notFound("Sample not found");
  return Response.json(s);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const s = getSample(params.id);
  if (!s || s.tenantId !== auth.tenantId) return notFound("Sample not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(s, body, { id: s.id, updatedAt: NOW() });
  // tenantId 归属不可被 body 改写
  s.tenantId = auth.tenantId;
  return Response.json(s);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const i = samples.findIndex((s) => s.id === params.id && s.tenantId === auth.tenantId);
  if (i < 0) return notFound("Sample not found");
  samples.splice(i, 1);
  return noContent();
}
