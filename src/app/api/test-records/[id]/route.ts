// M03.F03 检测记录：GET/PUT/DELETE /api/test-records/:id

import { NextRequest } from "next/server";
import { testRecords, getTestRecord } from "@lab/management-system-msw/fixtures";
import { notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = getTestRecord(params.id);
  if (!t) return notFound("TestRecord not found");
  return Response.json(t);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const t = getTestRecord(params.id);
  if (!t) return notFound("TestRecord not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(t, body, { id: t.id, updatedAt: NOW() });
  return Response.json(t);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = testRecords.findIndex((t) => t.id === params.id);
  if (i < 0) return notFound("TestRecord not found");
  testRecords.splice(i, 1);
  return noContent();
}
