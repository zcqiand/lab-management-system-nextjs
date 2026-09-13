// M06.F04 检测标准：GET/PUT/DELETE /api/inspection/standards/:code
//
// 数据源：lab_test.inspection_standards（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_standards schema 无 tenant_id 列（SSOT），
// dict 侧保持全局可见（与 fixture 版等价；种子行全部 TENANT-001 域）。

import { NextRequest, NextResponse } from "next/server";
import { notFound, noContent } from "@/lib/api-helpers";
import {
  DICT_CFGS,
  deleteDictDb,
  getDictDb,
  isDbUnavailable,
  putDictDb,
} from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const r = await getDictDb(DICT_CFGS.standards, params.code);
    if (!r) return notFound("Standard not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = await putDictDb(DICT_CFGS.standards, params.code, body);
    if (!r) return notFound("Standard not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const ok = await deleteDictDb(DICT_CFGS.standards, params.code);
    if (!ok) return notFound("Standard not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
