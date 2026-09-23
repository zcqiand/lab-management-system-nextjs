// M03.F03 检测记录 CRUD。
// GET  /api/test-records?sampleId=&receiptId=&page=&pageSize= → {items,page,pageSize,total}
//      （receiptId 经 receipt→samples 归集 sampleIds——REF 语义）
// POST /api/test-records → 201

import { NextResponse } from "next/server";
import { testRecords, getTestRecord, samples } from "@lab/management-system-msw/fixtures";
import { pageOf, qp, num, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(req: Request) {
  // @entry M03.F03.I08
  // token 化（2026-09-23 P3）：fixtures 行自带 tenantId，按 token 租户过滤
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const url = qp(req);
  const sampleId = url.get("sampleId");
  const receiptId = url.get("receiptId");
  let items = testRecords.filter((t) => t.tenantId === auth.tenantId);
  if (sampleId) items = items.filter((t) => t.sampleId === sampleId);
  if (receiptId) {
    const sids = new Set(
      samples.filter((s) => s.receiptId === receiptId).map((s) => s.id),
    );
    items = items.filter((t) => sids.has(t.sampleId));
  }
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}

export async function POST(req: Request) {
  // @entry M03.F03.I09
  // ADR-0019：租户 stamp 取 token claim，不信任 body.tenantId（放 ...body 后恒胜）
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newRec = {
    id: `TR-${Date.now().toString(36)}`,
    sampleId: String(body.sampleId ?? ""),
    parameterCode: String(body.parameterCode ?? ""),
    requirement: String(body.requirement ?? ""),
    result: String(body.result ?? ""),
    createdAt: NOW(),
    updatedAt: NOW(),
    ...body,
    tenantId: auth.tenantId,
  };
  testRecords.push(newRec as never);
  return NextResponse.json(newRec, { status: 201 });
}

void getTestRecord;
