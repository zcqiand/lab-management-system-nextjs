// M03.F03 检测记录 CRUD。
// GET  /api/test-records?sampleId=&receiptId=&page=&pageSize= → {items,page,pageSize,total}
//      （receiptId 经 receipt→samples 归集 sampleIds——REF 语义）
// POST /api/test-records → 201

import { NextRequest, NextResponse } from "next/server";
import { testRecords, getTestRecord, samples } from "@lab/management-system-msw/fixtures";
import { pageOf, qp, num, NOW, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const sampleId = url.get("sampleId");
  const receiptId = url.get("receiptId");
  let items = testRecords.filter((t) => t.tenantId === TENANT);
  if (sampleId) items = items.filter((t) => t.sampleId === sampleId);
  if (receiptId) {
    const sids = new Set(samples.filter((s) => s.receiptId === receiptId).map((s) => s.id));
    items = items.filter((t) => sids.has(t.sampleId));
  }
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newRec = {
    id: `TR-${Date.now().toString(36)}`,
    sampleId: String(body.sampleId ?? ""),
    parameterCode: String(body.parameterCode ?? ""),
    requirement: String(body.requirement ?? ""),
    result: String(body.result ?? ""),
    createdAt: NOW(),
    updatedAt: NOW(),
    tenantId: TENANT,
    ...body,
  };
  testRecords.push(newRec as never);
  return NextResponse.json(newRec, { status: 201 });
}

void getTestRecord;
