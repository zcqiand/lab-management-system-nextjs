// M06.F08 参数界面：list + create（契约路径，REQ-2026-001 由
// /api/inspection-param-interfaces 私生路径收敛而来）。
// GET  /api/param-interfaces?page=&pageSize=&keyword= → {items,page,pageSize,total}
//      （keyword 按 code/name 模糊，契约 Page<ParamInterface> 包）
// POST /api/param-interfaces → 201（code 必填 + config 若给必须为对象（表单结构
// schema，ADR-0056）；重复 code 400；version 服务端缺省 1）
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
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length)),
  );
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body["code"] ?? "").trim();
  if (!code)
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "code 必填" },
      { status: 400 },
    );
  // ADR-0056：config 升级为表单结构 schema（{title?, fields[], computed?, params?}），
  // 若给必须是对象（数组不算；componentPath 已随契约删除，不再校验）
  if (
    body["config"] !== undefined &&
    body["config"] !== null &&
    (typeof body["config"] !== "object" || Array.isArray(body["config"]))
  )
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "config 必须为对象（表单结构 schema）" },
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
    description: String(body["description"] ?? ""),
    // ADR-0056：version 服务端管理，缺省 1；isOfficial/sortOrder 随契约退役
    version: Number(body["version"] ?? 1),
    config: body["config"] ?? {},
    createdAt: now,
    updatedAt: now,
  };
  arr.push(row);
  return NextResponse.json(row, { status: 201 });
}
