// GET    /api/contracts/:id  → Contract | 404
// PUT    /api/contracts/:id  → Contract（updatedAt 重写）
// DELETE /api/contracts/:id  → 204

import { NextRequest, NextResponse } from "next/server";
import { contracts, getContract } from "@lab/management-system-msw/fixtures";

const NOW = () => new Date().toISOString();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = getContract(params.id);
  if (!c) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Contract not found" },
      { status: 404 },
    );
  }
  return NextResponse.json(c);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const c = getContract(params.id);
  if (!c) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Contract not found" },
      { status: 404 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(c, body, { id: c.id, tenantId: c.tenantId, updatedAt: NOW() });
  return NextResponse.json(c);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = contracts.findIndex((c) => c.id === params.id);
  if (i < 0) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Contract not found" },
      { status: 404 },
    );
  }
  contracts.splice(i, 1);
  return new NextResponse(null, { status: 204 });
}
