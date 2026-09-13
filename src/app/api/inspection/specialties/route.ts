// M06.F01 检测专项 CRUD。
// GET  /api/inspection/specialties?keyword=&page=&pageSize= → {items,page,pageSize,total}
//      （wrapDict 语义：id=code 补列 + keyword 字面子串；无 junction）
// POST /api/inspection/specialties → 201；重复 code → 400「专项编码已存在」
//
// 数据源：lab_test.inspection_specialties（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_specialties schema 无 tenant_id 列（SSOT），
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
      await listDictDb(DICT_CFGS.specialties, {
        keyword: url.get("keyword") ?? "",
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
  // fixture 版 row = { createdAt, updatedAt, ...body }（body 可覆盖时间戳，同款保留）
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  try {
    const res = await createDictDb(DICT_CFGS.specialties, row);
    if (!res.ok) return badRequest(res.message);
    return NextResponse.json(res.row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
