// M06.F03 检测参数：PUT/DELETE /api/inspection/parameters/:code
// （GET /:code 已于 2026-09-18 ADR-0029 甄别删除：shared 契约无此 op，
//   三前端 orval SDK 均只消费 list + PUT/DELETE /:code，零消费方即删。）
//
// 数据源：lab_test.inspection_parameters（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_parameters schema 无 tenant_id 列（SSOT），
// dict 侧保持全局可见（与 fixture 版等价；种子行全部 TENANT-001 域）。

import { NextRequest, NextResponse } from "next/server";
import { notFound, noContent } from "@/lib/api-helpers";
import { DICT_CFGS, deleteDictDb, isDbUnavailable, putDictDb } from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = await putDictDb(DICT_CFGS.parameters, params.code, body);
    if (!r) return notFound("Parameter not found");
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
    const ok = await deleteDictDb(DICT_CFGS.parameters, params.code);
    if (!ok) return notFound("Parameter not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
