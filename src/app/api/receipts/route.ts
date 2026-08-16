// GET  /api/receipts?page=&pageSize=&flowStatus=&contractId=&categoryCode=&lastSubmittedBy=&keyword=&filter=&operator=
//      -> {items,page,pageSize,total}（REF 形状；测试适配层 installShapeAdapters 同款过滤语义）
// POST /api/receipts -> SampleReceipt（201）
//
// 数据源：lab_dev.sample_receipts（src/lib/db-queries.ts；Task 6 接线）。
// filter（FlowStagePage 三态）语义相对 flowStatus 环节（与 lab-msw handler 同款）：
//   not_yet   = 停在本环节待提交（无 flowStatus 时=无流转记录的新单）
//   submitted = 已从本环节 submit 至下一环节（history 有 submit from 本环节且当前不在本环节）；
//               无 flowStatus 时=有流转记录且记录了提交人
// keyword 命中 commissionCode/reportCode/receivedBy 三字段（SQL ilike）；
// operator = receivedBy 或 testOperator 等值。FK null 出库保持 null（不转回 ''）。

import { NextRequest, NextResponse } from "next/server";
import { qp, num, NOW, TENANT } from "@/lib/api-helpers";
import {
  listReceiptsDb,
  createReceiptDb,
  isDbUnavailable,
} from "@/lib/db-queries";

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = qp(req);
    const data = await listReceiptsDb({
      flowStatus: url.get("flowStatus") ?? undefined,
      contractId: url.get("contractId") ?? undefined,
      categoryCode: url.get("categoryCode") ?? undefined,
      lastSubmittedBy: url.get("lastSubmittedBy") ?? undefined,
      operator: url.get("operator") ?? undefined,
      keyword: url.get("keyword") ?? "",
      filter: url.get("filter") ?? undefined,
      page: num(url.get("page"), 1),
      pageSize: num(url.get("pageSize"), 20),
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

function newId() {
  return `RECEIPT-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const now = NOW();
  const newReceipt = {
    contractId: String(body.contractId ?? ""),
    commissionCode: String(body.commissionCode ?? ""),
    commissionDate: String(body.commissionDate ?? ""),
    categoryCode: String(body.categoryCode ?? ""),
    receivedBy: String(body.receivedBy ?? ""),
    sampleSource: String(body.sampleSource ?? ""),
    testCategory: String(body.testCategory ?? ""),
    flowStatus: "receiving",
    flowHistory: [],
    ...body,
    // defaults 之后的 body 覆盖保留（msw 版同款），但固定列不可覆写：
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tenantId: TENANT,
  };
  try {
    const created = (await createReceiptDb(newReceipt)) as Record<string, unknown>;
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
