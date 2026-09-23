// M03.F03 样品 CRUD。
// GET  /api/samples?receiptId=&keyword=&page=&pageSize= → {items,page,pageSize,total}
//      （keyword 按 sampleCode/sampleName includes——REF 语义，测试适配层同款）
// POST /api/samples → 201

import { NextRequest, NextResponse } from "next/server";
import { samples, getSample } from "@lab/management-system-msw/fixtures";
import { pageOf, qp, num, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest) {
  // token 化（2026-09-23 P3）：fixtures 行自带 tenantId，按 token 租户过滤
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const url = qp(req);
  const receiptId = url.get("receiptId");
  const keyword = url.get("keyword") ?? "";
  let items = samples.filter((s) => s.tenantId === auth.tenantId);
  if (receiptId) items = items.filter((s) => s.receiptId === receiptId);
  if (keyword)
    items = items.filter((s) => {
      const rec = s as { sampleCode?: string; sampleName?: string };
      return (
        (rec.sampleCode ?? "").includes(keyword) ||
        (rec.sampleName ?? "").includes(keyword)
      );
    });
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}

export async function POST(req: NextRequest) {
  // ADR-0019：租户 stamp 取 token claim，不信任 body.tenantId
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newSample = {
    id: `SAMPLE-${Date.now().toString(36)}`,
    receiptId: String(body.receiptId ?? ""),
    sampleCode: String(body.sampleCode ?? ""),
    ext: body.ext ?? {},
    createdAt: NOW(),
    updatedAt: NOW(),
    ...body,
    // 放 ...body 之后：claim 恒胜，body.tenantId 不被信任（ADR-0019）
    tenantId: auth.tenantId,
  };
  samples.push(newSample as never);
  return NextResponse.json(newSample, { status: 201 });
}

void getSample;
