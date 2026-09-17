// POST /api/receipts/data-entry/act — M03 7 阶段全 act 模式（契约 op actFlowDataEntry）。
// 共用体 src/lib/act-route.ts；stage-guard 语义见 db-queries.ts actForStageDb 注释。

import { NextRequest } from "next/server";
import { handleActRequest } from "@/lib/act-route";

export async function POST(req: NextRequest): Promise<Response> {
  return handleActRequest(req, "data-entry");
}
