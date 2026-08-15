// M06.F02 检测项目：GET/PUT/DELETE /api/inspection/objects/:code

import { NextRequest } from "next/server";
import { inspectionObjects, getObject } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = getObject(params.code);
  if (!r) return notFound("Object not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const r = getObject(params.code);
  if (!r) return notFound("Object not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { code: r.code, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const i = inspectionObjects.findIndex((o) => o.code === params.code);
  if (i < 0) return notFound("Object not found");
  inspectionObjects.splice(i, 1);
  return noContent();
}
