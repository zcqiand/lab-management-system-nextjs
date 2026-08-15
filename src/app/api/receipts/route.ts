// GET  /api/receipts?page=&pageSize=&flowStatus=&contractId=&categoryCode=&lastSubmittedBy=&keyword=&filter=
//      → {items,page,pageSize,total}（REF 形状；测试适配层 installShapeAdapters 同款过滤语义）
// POST /api/receipts → SampleReceipt（201）
//
// 数据源：@lab/management-system-msw/fixtures sampleReceipts（in-memory）。
// filter（FlowStagePage 三态）：not_yet=无流转记录的新单，submitted=本人已提交。
// msw handler 无此参数；语义按组件注释（「已提交至下一环节且未被处理」）实现为
// lastSubmittedBy 已设 + flowHistory 非空。

import { NextRequest, NextResponse } from "next/server";
import { sampleReceipts, pageOf, qp, num, NOW, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const flowStatus = url.get("flowStatus");
  const contractId = url.get("contractId");
  const categoryCode = url.get("categoryCode");
  const lastSubmittedBy = url.get("lastSubmittedBy");
  const operator = url.get("operator") ?? "";
  const filter = url.get("filter");
  const keyword = url.get("keyword") ?? "";
  let items = sampleReceipts.filter((r) => r.tenantId === TENANT);
  if (flowStatus) items = items.filter((r) => r.flowStatus === flowStatus);
  if (contractId) items = items.filter((r) => r.contractId === contractId);
  if (categoryCode) items = items.filter((r) => r.categoryCode === categoryCode);
  if (lastSubmittedBy) items = items.filter((r) => r.lastSubmittedBy === lastSubmittedBy);
  if (filter === "not_yet")
    items = items.filter((r) => (r.flowHistory ?? []).length === 0);
  if (filter === "submitted")
    items = items.filter((r) => (r.flowHistory ?? []).length > 0 && !!r.lastSubmittedBy);
  void operator;
  if (keyword)
    items = items.filter((r) => {
      const rec = r as { commissionCode?: string; reportCode?: string; receivedBy?: string };
      return (
        (rec.commissionCode ?? "").includes(keyword) ||
        (rec.reportCode ?? "").includes(keyword) ||
        (rec.receivedBy ?? "").includes(keyword)
      );
    });
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newReceipt = {
    id: `RECEIPT-${Date.now().toString(36)}`,
    contractId: String(body.contractId ?? ""),
    commissionCode: String(body.commissionCode ?? ""),
    commissionDate: String(body.commissionDate ?? ""),
    categoryCode: String(body.categoryCode ?? ""),
    receivedBy: String(body.receivedBy ?? ""),
    sampleSource: String(body.sampleSource ?? ""),
    testCategory: String(body.testCategory ?? ""),
    flowStatus: "receiving",
    flowHistory: [],
    createdAt: NOW(),
    updatedAt: NOW(),
    tenantId: TENANT,
    ...body,
  };
  sampleReceipts.push(newReceipt as never);
  return NextResponse.json(newReceipt, { status: 201 });
}
