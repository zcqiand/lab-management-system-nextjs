// catalog 4 码表（型号/规格/等级/牌号）共享 GET/POST —— lab-msw catalogHandlers
// 工厂的 Next route 版。msw 返回裸数组；REF SampleManagerModal 读 res.data.items[].name，
// 故包成 {items,total}。

import { NextRequest, NextResponse } from "next/server";
import { pageOf, qp, num, NOW } from "@/lib/api-helpers";

export function catalogGet(arr: Record<string, unknown>[], req: NextRequest) {
  const url = qp(req);
  const obj = url.get("inspectionObjectCode");
  let items = arr;
  if (obj) items = items.filter((e) => e["inspectionObjectCode"] === obj);
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), items.length || 1)),
  );
}

export async function catalogPost(arr: Record<string, unknown>[], req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entry = {
    code: String(body.code ?? ""),
    name: String(body.name ?? ""),
    sortOrder: Number(body.sortOrder ?? 0),
    createdAt: NOW(),
    updatedAt: NOW(),
    ...body,
  };
  arr.push(entry as never);
  return NextResponse.json(entry, { status: 201 });
}
