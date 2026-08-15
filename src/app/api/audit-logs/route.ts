// M98 审计日志。
// GET /api/audit-logs?type=&keyword=&page=&pageSize= → {items,page,pageSize,total}
// lab-msw 无此端点；条目从 fixtures flowHistory 派生（type='flow'，操作对象=委托书编号），
// 支持 auditStore 的分页 + type/keyword 过滤（dateFrom/dateTo 宽松忽略）——
// 测试适配层 Task 11 同款语义。

import { NextRequest, NextResponse } from "next/server";
import { sampleReceipts, pageOf, qp, num, TENANT } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = qp(req);
  const type = url.get("type");
  const keyword = url.get("keyword") ?? "";
  const entries: Array<{
    id: string;
    type: string;
    action: string;
    operator: string;
    target: string;
    targetId?: string;
    detail?: string;
    at: string;
  }> = [];
  for (const r of sampleReceipts.filter((x) => x.tenantId === TENANT)) {
    const rec = r as {
      id: string;
      commissionCode?: string;
      flowHistory?: Array<{
        action: string;
        from: string;
        to: string;
        operator: string;
        at: string;
        reason?: string;
      }>;
    };
    for (const [i, h] of (rec.flowHistory ?? []).entries()) {
      const actionLabel = h.action === "submit" ? "提交" : h.action === "return" ? "退回" : "撤回";
      entries.push({
        id: `audit-${rec.id}-${i}`,
        type: "flow",
        action: `${actionLabel}（${h.from} → ${h.to}）`,
        operator: h.operator,
        target: rec.commissionCode ?? rec.id,
        targetId: rec.id,
        detail: h.reason,
        at: h.at,
      });
    }
  }
  let items = entries;
  if (type) items = items.filter((e) => e.type === type);
  if (keyword) {
    items = items.filter(
      (e) =>
        e.action.includes(keyword) ||
        e.operator.includes(keyword) ||
        e.target.includes(keyword) ||
        (e.detail ?? "").includes(keyword),
    );
  }
  items = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json(
    pageOf(items, num(url.get("page"), 1), num(url.get("pageSize"), 20)),
  );
}
