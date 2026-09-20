// M03 7 阶段全 act 模式路由共用体（2026-09-17 SSOT 清理 Phase B1）。
// 契约：POST /api/receipts/{receiving|assigning|data-entry|review|approve|
// issuance|archived}/act，body = FlowActionRequest { ids, action, operator,
// reason? }，response = FlowActionResult[]（裸数组）。
// 各 stage 的 route.ts 只传自己的 stage 段；stage-guard 语义在
// db-queries.ts actForStageDb（对齐 springboot/aspnetcore）。

import { NextRequest, NextResponse } from "next/server";
import { actForStageDb, isDbUnavailable } from "@/lib/db-queries";

const ACTIONS = ["submit", "return", "withdraw"] as const;
type Action = (typeof ACTIONS)[number];

export async function handleActRequest(
  req: NextRequest,
  stagePath: string,
): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as {
    ids?: unknown;
    action?: unknown;
    operator?: unknown;
    reason?: unknown;
  };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "ids (non-empty string[]) is required" },
      { status: 400 },
    );
  }
  if (
    typeof body.action !== "string" ||
    !(ACTIONS as readonly string[]).includes(body.action)
  ) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: `action must be one of ${ACTIONS.join("|")}` },
      { status: 400 },
    );
  }
  // operator 契约必填（FlowActionRequest.operator: string）——缺失即 400，
  // 不做「anonymous」兜底（业务身份字段禁止字面量兜底，ADR-0019）
  if (typeof body.operator !== "string" || body.operator.length === 0) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "operator is required" },
      { status: 400 },
    );
  }
  try {
    const results = await actForStageDb(
      stagePath,
      body.ids as string[],
      body.action as Action,
      body.operator,
      typeof body.reason === "string" ? body.reason : undefined,
    );
    return NextResponse.json(results);
  } catch (e) {
    if (isDbUnavailable(e))
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    throw e;
  }
}
