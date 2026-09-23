// M06.F08 参数界面：list + create（契约路径，REQ-2026-001 由
// /api/inspection-param-interfaces 私生路径收敛而来）。
// GET  /api/param-interfaces?page=&pageSize=&keyword= → {items,page,pageSize,total}
//      （keyword 按 code/name 模糊，契约 Page<ParamInterface> 包）
// POST /api/param-interfaces → 201（code/componentPath 必填，重复 code 400）
//
// 详情 GET/PUT/DELETE 走 /api/param-interfaces/[code]。

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { fixturesSingleton } from "@/lib/fixtures-runtime";

const inspectionParamInterfaces = fixturesSingleton.inspectionParamInterfaces;
import { pageOf, num, NOW, qp } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const url = qp(req);
  const keyword = url.get("keyword")?.trim();
  let items = inspectionParamInterfaces as unknown as Record<string, unknown>[];
  if (keyword) {
    items = items.filter(
      (e) =>
        String(e["code"] ?? "").includes(keyword) ||
        String(e["name"] ?? "").includes(keyword),
    );
  }
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length || 1)),
  );
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body["code"] ?? "").trim();
  if (!code || !body["componentPath"])
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "code/componentPath 必填" },
      { status: 400 },
    );
  const arr = inspectionParamInterfaces as unknown as Record<string, unknown>[];
  if (arr.some((r) => r["code"] === code))
    return NextResponse.json(
      { code: "CONFLICT", message: "参数界面编码已存在" },
      { status: 400 },
    );
  const now = NOW();
  const row = {
    code,
    name: String(body["name"] ?? ""),
    componentPath: String(body["componentPath"] ?? ""),
    description: String(body["description"] ?? ""),
    isOfficial: Boolean(body["isOfficial"] ?? false),
    sortOrder: Number(body["sortOrder"] ?? 0),
    config: body["config"] ?? {},
    createdAt: now,
    updatedAt: now,
  };
  arr.push(row);
  return NextResponse.json(row, { status: 201 });
}
