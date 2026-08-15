// M06.F03 检测参数：GET/PUT/DELETE /api/inspection/parameters/:code

import { NextRequest } from "next/server";
import { inspectionParameters, getParameter } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = getParameter(params.code);
  if (!r) return notFound("Parameter not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const r = getParameter(params.code);
  if (!r) return notFound("Parameter not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { code: r.code, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const i = inspectionParameters.findIndex((p) => p.code === params.code);
  if (i < 0) return notFound("Parameter not found");
  inspectionParameters.splice(i, 1);
  return noContent();
}
