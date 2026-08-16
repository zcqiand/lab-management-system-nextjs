// M06.F08 参数界面：list + create。
// GET  /api/inspection-param-interfaces → {items,total,page,pageSize}（msw dictCrud 同款：补 id=code）
// POST /api/inspection-param-interfaces → 201（新建模型卡）
//
// 详情 GET/PUT/DELETE 走 /api/inspection-param-interfaces/[id]（/:id 命中 code 或 id）。
// 本文件原本误把详情 handler 放在 list 路径下，导致 ReceiptDetail.tsx 的 Promise.all
// 在 /inspection-param-interfaces?page=1&pageSize=500 处 500 → catch 吞掉 → setSamples
// 从未执行 → /receipts/[id] 详情页 样品信息 整段空白。

import { NextRequest, NextResponse } from "next/server";
import { inspectionParamInterfaces } from "@lab/management-system-msw/fixtures";
import { pageOf, num, NOW, qp } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const items = (inspectionParamInterfaces as unknown as Record<string, unknown>[]).map((e) => ({
    ...e,
    id: String(e["id"] ?? e["code"]),
  }));
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length || 1)),
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body["code"] ?? "").trim();
  if (!code) return NextResponse.json({ code: "BAD_REQUEST", message: "code 必填" }, { status: 400 });
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
  (inspectionParamInterfaces as unknown as Record<string, unknown>[]).push(row);
  return NextResponse.json({ ...row, id: code }, { status: 201 });
}
