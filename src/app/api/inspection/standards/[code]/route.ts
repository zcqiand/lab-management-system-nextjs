// M06.F04 检测标准：GET/PUT/DELETE /api/inspection/standards/:code

import { NextRequest } from "next/server";
import { inspectionStandards, getStandard } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = getStandard(params.code);
  if (!r) return notFound("Standard not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const r = getStandard(params.code);
  if (!r) return notFound("Standard not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { code: r.code, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const i = inspectionStandards.findIndex((s) => s.code === params.code);
  if (i < 0) return notFound("Standard not found");
  inspectionStandards.splice(i, 1);
  return noContent();
}
