// M06.F08 参数界面 CRUD（REF 语义版——测试适配层 Task 13 Step 3 同款：
// POST 校验必填 + 重复 400；id=pi-<code>；isOfficial 内置不可删）。
// GET  /api/param-interfaces?keyword=&page=&pageSize= → {items,total}（wrapDict 补 id）
// POST /api/param-interfaces → 201

import { NextRequest, NextResponse } from "next/server";
import { paramInterfaces } from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(paramInterfaces as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body["code"] || !body["name"] || !body["componentPath"])
    return badRequest("code/name/componentPath 必填");
  if ((paramInterfaces as unknown as Array<{ code?: string }>).some((r) => r.code === body["code"]))
    return badRequest("参数界面编码已存在");
  const now = NOW();
  const row = {
    id: `pi-${String(body["code"])}`,
    code: body["code"],
    name: body["name"],
    componentPath: body["componentPath"],
    config: body["config"] ?? null,
    description: body["description"] ?? "",
    sortOrder: body["sortOrder"] ?? 999999,
    isOfficial: false,
    createdAt: now,
    updatedAt: now,
    tenantId: TENANT,
  };
  paramInterfaces.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
