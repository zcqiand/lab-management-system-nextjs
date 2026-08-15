// M03.F03.I06 人工改判：PATCH /api/test-records/:id/verdict {verdict}

import { NextRequest } from "next/server";
import { getTestRecord } from "@lab/management-system-msw/fixtures";
import { notFound, NOW } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const t = getTestRecord(params.id);
  if (!t) return notFound("TestRecord not found");
  const body = (await req.json().catch(() => ({}))) as { verdict?: string };
  Object.assign(t, { verdict: String(body.verdict ?? ""), updatedAt: NOW() });
  return Response.json(t);
}
