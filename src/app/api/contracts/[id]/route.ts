// GET    /api/contracts/:id  → Contract | 404
// PUT    /api/contracts/:id  → Contract（updatedAt 重写）
// DELETE /api/contracts/:id  → 204
//
// T11：msw fixtures 内存数组 → lab_dev PG 迁移（三后端共库；行读写下沉
// db-queries.ts contracts 域）。404 / Object.assign 局部更新语义零改动。

import { NextRequest, NextResponse } from "next/server";
import {
  deleteContractDb,
  getContractDb,
  isDbUnavailable,
  updateContractDb,
} from "@/lib/db-queries";

const NOW = () => new Date().toISOString();

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const c = await getContractDb(params.id);
    if (!c) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Contract not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(c);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const c = await updateContractDb(params.id, { ...body, updatedAt: NOW() });
    if (!c) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Contract not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(c);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteContractDb(params.id);
    if (!ok) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Contract not found" },
        { status: 404 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
