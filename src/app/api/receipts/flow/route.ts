// POST /api/receipts/flow → {results}（REF 形状；组件 runFlow 读 res.data.results）
//
// submit（前进一阶 + lastSubmittedBy + issuance 补 issuedAt）/ return（后退一阶）/
// withdraw（后退一阶 + 清 lastSubmittedBy，仅限本人提交的）——语义与
// tests/helpers/seed.ts Task 11 适配层一致（lab-msw 原版 withdraw 是 no-op 债）。

import { NextRequest, NextResponse } from "next/server";
import {
  sampleReceipts,
  applyFlowAction,
  findReceipt,
  type FlowActionFull,
} from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    action?: FlowActionFull;
    operator?: string;
    reason?: string;
  };
  if (!Array.isArray(body.ids) || !body.action) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "ids and action are required" },
      { status: 400 },
    );
  }
  const operator = String(body.operator ?? "anonymous");
  const results = body.ids.map((id) => {
    const r = findReceipt(id);
    if (!r) return { id, ok: false, message: "Receipt not found" };
    return applyFlowAction(r, body.action as FlowActionFull, operator, body.reason);
  });
  return NextResponse.json({ results });
}

void sampleReceipts;
