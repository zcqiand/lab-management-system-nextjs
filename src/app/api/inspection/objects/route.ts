// M06.F02 检测项目 CRUD。
// GET  /api/inspection/objects → {items,page,pageSize,total}（wrapDict：id=code + keyword +
//      inspectionSpecialtyCode 直列过滤 + 聚合列 parameterNames/standardCodes——老 shared
//      lab-handlers 语义）
// POST /api/inspection/objects → 201；重复 code → 400「项目编码已存在」
//
// 数据源：lab_test.inspection_objects（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_objects schema 无 tenant_id 列（SSOT），
// dict 侧保持全局可见（与 fixture 版等价；种子行全部 TENANT-001 域）。

import { NextRequest, NextResponse } from "next/server";
import { badRequest, num, qp, NOW } from "@/lib/api-helpers";
import { DICT_CFGS, createDictDb, isDbUnavailable, listDictDb } from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = qp(req);
    return NextResponse.json(
      await listDictDb(DICT_CFGS.objects, {
        keyword: url.get("keyword") ?? "",
        direct: { inspectionSpecialtyCode: url.get("inspectionSpecialtyCode") ?? "" },
        page: num(url.get("page"), 1),
        pageSizeParam: url.get("pageSize"),
      }),
    );
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  try {
    const res = await createDictDb(DICT_CFGS.objects, row);
    if (!res.ok) return badRequest(res.message);
    return NextResponse.json(res.row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
