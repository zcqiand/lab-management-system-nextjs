// M06.F01 检测专项：GET/PUT/DELETE /api/inspection/specialties/:code

import { NextRequest } from "next/server";
import { inspectionSpecialties, getSpecialty } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = getSpecialty(params.code);
  if (!r) return notFound("Specialty not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const r = getSpecialty(params.code);
  if (!r) return notFound("Specialty not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { code: r.code, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const i = inspectionSpecialties.findIndex((s) => s.code === params.code);
  if (i < 0) return notFound("Specialty not found");
  inspectionSpecialties.splice(i, 1);
  return noContent();
}
