// M05.F01.I05 见证取样跟踪 — 计算内核（纯函数，route 与测试共用）。
//
// 语义（本仓首发定义；BASE 契约化前以此为准）：
//   需见证 = 接样单所属合同的见证人已安排（contract.witness 非空）
//   已见证 = 接样单自身 witness 已登记（接样时见证人在场记录）
//   见证率 = witnessed / requireWitness（三位小数四舍五入；分母 0 → 0）
//
// B 通道注记（2026-11-07 人裁）：witnessStats 目前在 shared DashboardStats 契约之外
// （BFF 路由层扩展）。兄弟仓实现时须走 shared tsp 正门（tsp/routes/summary.tsp 扩
// model → 重出 openapi → 各仓 regenerate），届时本文件的 WitnessStats 类型转正删除。

/** 输入接样单的见证相关投影（结构化最小面，不绑 vendor fixtures 类型）。 */
export interface WitnessStatsInputReceipt {
  contractId: string;
  commissionCode?: string;
  projectName?: string;
  witness?: string;
}

/** 输入合同的见证相关投影。 */
export interface WitnessStatsInputContract {
  id: string;
  contractCode?: string;
  projectName?: string;
  witnessUnit?: string;
  witness?: string;
}

/** 见证到位情况明细行。 */
export interface WitnessDetail {
  commissionCode: string;
  projectName: string;
  witnessUnit: string;
  witness: string;
  witnessed: boolean;
}

/** witnessStats 载荷（/api/summary/stats 扩展字段，B 通道）。 */
export interface WitnessStats {
  requireWitness: number;
  witnessed: number;
  witnessRate: number;
  details: WitnessDetail[];
}

function nonEmpty(v: string | undefined | null): boolean {
  return Boolean(v && String(v).trim());
}

export function computeWitnessStats(
  receipts: WitnessStatsInputReceipt[],
  contracts: WitnessStatsInputContract[],
): WitnessStats {
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const details: WitnessDetail[] = [];
  let witnessed = 0;
  for (const r of receipts) {
    const c = contractById.get(r.contractId);
    // 合同无见证安排（或合同缺失）→ 不计入需见证面
    if (!c || !nonEmpty(c.witness)) continue;
    const done = nonEmpty(r.witness);
    if (done) witnessed += 1;
    details.push({
      commissionCode: r.commissionCode ?? "",
      projectName: r.projectName ?? c.projectName ?? "",
      witnessUnit: c.witnessUnit ?? "",
      witness: nonEmpty(r.witness) ? String(r.witness) : String(c.witness ?? ""),
      witnessed: done,
    });
  }
  const requireWitness = details.length;
  const witnessRate =
    requireWitness > 0 ? Math.round((witnessed / requireWitness) * 1000) / 1000 : 0;
  return { requireWitness, witnessed, witnessRate, details };
}
