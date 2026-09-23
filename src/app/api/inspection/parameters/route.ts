// M06.F03 检测参数 CRUD。
// GET  /api/inspection/parameters → {items,page,pageSize,total}（wrapDict：id=code + keyword；
//      按专项过滤经 specialty_objects→object_parameters 两跳 junction 反查、按项目/标准
//      过滤经一跳反查；聚合列 objectNames/standardCodes）
// POST /api/inspection/parameters → 201；重复 code → 400「参数编码已存在」
//
// 数据源：lab_test.inspection_parameters（src/lib/db-queries.ts DICT_CFGS；Batch1 接真库）。
// fixture 版本无 tenant 过滤；inspection_parameters schema 无 tenant_id 列（SSOT），
// dict 表无租户列——认证但全局域（只加 401 门，不过滤，ADR-0019 语义对齐）。

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { badRequest, num, qp, NOW } from "@/lib/api-helpers";
import { DICT_CFGS, createDictDb, isDbUnavailable, listDictDb } from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  // dict 4 表 schema 无租户列 = 认证但全局（aspnetcore DictionaryController 同语义）；token 化只加 401 门
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const url = qp(req);
    return NextResponse.json(
      await listDictDb(auth.tenantId, DICT_CFGS.parameters, {
        keyword: url.get("keyword") ?? "",
        direct: {
          inspectionSpecialtyCode: url.get("inspectionSpecialtyCode") ?? "",
          inspectionObjectCode: url.get("inspectionObjectCode") ?? "",
          inspectionStandardCode: url.get("inspectionStandardCode") ?? "",
        },
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
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  try {
    const res = await createDictDb(auth.tenantId, DICT_CFGS.parameters, row);
    if (!res.ok) return badRequest(res.message);
    return NextResponse.json(res.row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
