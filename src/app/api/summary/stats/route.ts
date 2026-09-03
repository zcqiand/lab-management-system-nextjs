// GET /api/summary/stats → 仪表盘统计（lab-msw summaryExtraHandlers 同款形状）
//
// 既有（pre-I03/I04）：
//   contractCount / receiptCount / sampleCount
//   reportCountByStatus:{draft, reviewing, issued}
//   pendingTaskCount
//
// 新增 M05.F01.I03 核心指标：
//   todayTestCount           今日试验总数（createdAt 或 testStartDate 为今日）
//   qualifiedRateByMaterial  按材料类型合格率（concrete/rebar/sand）
//   reportOutputByStatus     报告产出量（{generated, pending, issued}）
//
// 新增 M05.F01.I04 任务漏斗：
//   funnelByStage:{pending_collect, received, testing, reporting, reviewing, issued}

import { NextResponse } from "next/server";
import { sampleReceipts, samples, TENANT } from "@/lib/api-helpers";
import { contracts, inspectionReportNames } from "@lab/management-system-msw/fixtures";

// 材料类型映射：categoryCode → inspectionReportNames.summaryName → 关键词匹配
const MATERIAL_KEYWORDS: Record<string, string[]> = {
  concrete: ["混凝土", "水泥"],
  rebar: ["钢筋", "钢材", "焊接", "机械连接", "连接"],
  sand: ["砂", "碎（卵）石", "轻集料", "颗粒级配"],
};

function materialOf(categoryCode: string): keyof typeof MATERIAL_KEYWORDS | null {
  const rn = (inspectionReportNames as unknown as Array<{ code: string; summaryName?: string }>).find(
    (r) => r.code === categoryCode,
  );
  const name = rn?.summaryName ?? "";
  for (const [k, kws] of Object.entries(MATERIAL_KEYWORDS)) {
    if (kws.some((kw) => name.includes(kw))) {
      return k as keyof typeof MATERIAL_KEYWORDS;
    }
  }
  return null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const todayStr = today();
  const rows = (sampleReceipts as unknown as Array<Record<string, unknown>>).filter(
    (r) => r["tenantId"] === TENANT,
  );
  const byStatus = (s: string) => rows.filter((r) => r["flowStatus"] === s).length;

  // ─── I03 核心指标 ───
  // 今日试验总数：createdAt 起头 OR testStartDate 是今日
  const todayTestCount = rows.filter((r) => {
    const c = String(r["createdAt"] ?? "");
    const t = String(r["testStartDate"] ?? "");
    return c.startsWith(todayStr) || t === todayStr;
  }).length;

  // 检测合格率（按材料）
  const qualifiedRateByMaterial: Record<
    string,
    { total: number; pass: number; rate: number }
  > = {
    concrete: { total: 0, pass: 0, rate: 0 },
    rebar: { total: 0, pass: 0, rate: 0 },
    sand: { total: 0, pass: 0, rate: 0 },
  };
  for (const r of rows) {
    const cat = String(r["categoryCode"] ?? "");
    const mat = materialOf(cat);
    if (!mat) continue;
    const e = qualifiedRateByMaterial[mat];
    if (!e) continue;
    e.total += 1;
    if (r["result"] === "pass") e.pass += 1;
  }
  for (const k of Object.keys(qualifiedRateByMaterial)) {
    const e = qualifiedRateByMaterial[k];
    if (!e) continue;
    e.rate = e.total > 0 ? Math.round((e.pass / e.total) * 1000) / 1000 : 0;
  }

  // 报告产出量：按 reportCode + flowStatus 切分
  const generatedCount = rows.filter((r) => Boolean(r["reportCode"])).length;
  const pendingCount =
    byStatus("review") + byStatus("approval");
  const issuedCount =
    byStatus("issuance") + byStatus("archived") + byStatus("completed");
  const reportOutputByStatus = {
    generated: generatedCount,
    pending: pendingCount,
    issued: issuedCount,
  };

  // ─── I04 任务漏斗（6 段）───
  // pending_collect: flowStatus='receiving'
  // received:        flowStatus='task_assignment'（接样完成 → 等分配）
  // testing:         flowStatus='data_entry' 且无 reportCode
  // reporting:       flowStatus='data_entry' 且 reportCode 已有
  // reviewing:       flowStatus='review' 或 'approval'
  // issued:          flowStatus='issuance'/'archived'/'completed'
  const dataEntryNoReport = rows.filter(
    (r) => r["flowStatus"] === "data_entry" && !r["reportCode"],
  ).length;
  const dataEntryWithReport = rows.filter(
    (r) => r["flowStatus"] === "data_entry" && r["reportCode"],
  ).length;
  const funnelByStage = {
    pending_collect: byStatus("receiving"),
    received: byStatus("task_assignment"),
    testing: dataEntryNoReport,
    reporting: dataEntryWithReport,
    reviewing: byStatus("review") + byStatus("approval"),
    issued: issuedCount,
  };

  // ─── 既有形状（向后兼容 I02 老测试）───
  return NextResponse.json({
    contractCount: contracts.length,
    receiptCount: rows.length,
    sampleCount: samples.length,
    reportCountByStatus: {
      draft: byStatus("receiving") + byStatus("task_assignment") + byStatus("data_entry"),
      reviewing: byStatus("review") + byStatus("approval"),
      issued: issuedCount,
    },
    pendingTaskCount:
      byStatus("task_assignment") + byStatus("data_entry") + byStatus("review"),
    // M05.F01.I03
    todayTestCount,
    qualifiedRateByMaterial,
    reportOutputByStatus,
    // M05.F01.I04
    funnelByStage,
  });
}