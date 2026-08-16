// POST /api/receipts/flow → {results}（REF 形状；组件 runFlow 读 res.data.results）
//
// submit（前进一阶 + lastSubmittedBy + issuance 补 issuedAt）/ return（后退一阶）/
// withdraw（后退一阶 + 清 lastSubmittedBy，仅限本人提交的）——语义在
// src/lib/db-queries.ts applyFlowActionDb（事务 + select for update；Task 6 接线，
// 每条 id 独立事务，单条失败不影响其余）。

import { NextRequest, NextResponse } from "next/server";
import {
  applyFlowActionDb,
  isDbUnavailable,
  type FlowActionFull,
} from "@/lib/db-queries";

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
  try {
    const results = [];
    for (const id of body.ids) {
      // not found 由 db 层以值返回（ok:false, message:"Receipt not found"），
      // 单条连接失败也降级为该条的 ok:false，不拖垮整批。
      results.push(await applyFlowActionDb(id, body.action, operator, body.reason));
    }
    return NextResponse.json({ results });
  } catch (e) {
    if (isDbUnavailable(e))
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    throw e;
  }
}
