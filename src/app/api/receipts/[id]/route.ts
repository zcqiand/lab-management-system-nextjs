// GET    /api/receipts/:id  → SampleReceipt | 404
// PUT    /api/receipts/:id  → SampleReceipt（updatedAt 重写）
// DELETE /api/receipts/:id  → 204

import { NextRequest } from "next/server";
import { sampleReceipts, findReceipt, notFound, noContent, NOW } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = findReceipt(params.id);
  if (!r) return notFound("Receipt not found");
  return Response.json(r);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const r = findReceipt(params.id);
  if (!r) return notFound("Receipt not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(r, body, { id: r.id, updatedAt: NOW() });
  return Response.json(r);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = sampleReceipts.findIndex((r) => r.id === params.id);
  if (i < 0) return notFound("Receipt not found");
  sampleReceipts.splice(i, 1);
  return noContent();
}
