// M03.F03 样品：GET/PUT/DELETE /api/samples/:id

import { NextRequest } from "next/server";
import { samples, getSample } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSample(params.id);
  if (!s) return notFound("Sample not found");
  return Response.json(s);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSample(params.id);
  if (!s) return notFound("Sample not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(s, body, { id: s.id, updatedAt: NOW() });
  return Response.json(s);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = samples.findIndex((s) => s.id === params.id);
  if (i < 0) return notFound("Sample not found");
  samples.splice(i, 1);
  return noContent();
}
