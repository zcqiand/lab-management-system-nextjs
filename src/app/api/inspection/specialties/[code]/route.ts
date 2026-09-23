// M06.F01 检测专项：PUT/DELETE /api/inspection/specialties/:code
// （GET /:code 已于 2026-09-18 ADR-0029 甄别删除：shared 契约无此 op，
//   三前端 orval SDK 均只消费 list + PUT/DELETE /:code，零消费方即删。）
//
// 数据源：lab_test.inspection_specialties（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_specialties schema 无 tenant_id 列（SSOT），
// dict 表无租户列——认证但全局域（只加 401 门，不过滤，ADR-0019 语义对齐）。

import { NextRequest } from "next/server";
import { notFound, noContent } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";
import { DICT_CFGS, deleteDictDb, isDbUnavailable, putDictDb } from "@/lib/db-queries";
import { NextResponse } from "next/server";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = await putDictDb(auth.tenantId, DICT_CFGS.specialties, params.code, body);
    if (!r) return notFound("Specialty not found");
    return Response.json(r);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const ok = await deleteDictDb(auth.tenantId, DICT_CFGS.specialties, params.code);
    if (!ok) return notFound("Specialty not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
