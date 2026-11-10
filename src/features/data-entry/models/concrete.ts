// 算法域：混凝土抗压 / 抗渗（ADR-0056 从 ConcreteCompressCard / ConcretePermeabilityCard
// 原样提炼的纯函数——渲染层不再内联业务计算）。

/** 试件数（混凝土抗渗标准为 6 个圆台试件）。 */
export const PERMEABILITY_SPECIMEN_COUNT = 6;

/** 渗水情况枚举。 */
export type Permeation = "已渗" | "未渗";

export interface PermeabilitySpecimen {
  pressure: number; // MPa；0 = 未填
  permeated: Permeation;
}

/** 荷载(kN) + 受压面积(mm²) → 抗压强度(MPa) + 代表值(均值)，均保留 2 位。
 *  0 计入 filter（与退役卡锁定行为一致：0 只是不显示，不算异常）。 */
export function computeConcreteCompress(
  loads: number[],
  area: number,
): { strengths: number[]; representative: number | undefined } {
  const strengths = loads
    .filter((v) => v !== null && !Number.isNaN(v))
    .map((v) => Math.round(((v * 1000) / area) * 100) / 100);
  if (strengths.length === 0) return { strengths: [], representative: undefined };
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  return { strengths, representative: Math.round(mean * 100) / 100 };
}

/**
 * 按 GB/T 50082-2009 计算抗渗等级：
 * 6 个试件中第 3 个渗水试件的渗水压力 = 抗渗等级（MPa 数值）。
 * 不足 3 个渗水 → grade=undefined，reason="未达到 Pn"。
 */
export function computeConcretePermeability(specimens: PermeabilitySpecimen[]): {
  grade: number | undefined;
  gradeLabel: string;
  reason: string | undefined;
} {
  const permeatedPressures: number[] = [];
  for (const s of specimens) {
    if (s.permeated === "已渗" && s.pressure > 0) permeatedPressures.push(s.pressure);
  }
  if (permeatedPressures.length >= 3) {
    // 取第 3 个渗水试件的压力为抗渗等级
    const grade = permeatedPressures[2]!;
    return {
      grade,
      gradeLabel: `P${Math.round(grade * 10)}`,
      reason: undefined,
    };
  }
  if (permeatedPressures.length === 0) {
    // 全部未渗：取 6 个试件中的最大试验压力作为"未达到"的上界
    const maxPressure = specimens.reduce((m, s) => Math.max(m, s.pressure), 0);
    if (maxPressure > 0) {
      return {
        grade: undefined,
        gradeLabel: `未达到 P${Math.round(maxPressure * 10)}`,
        reason: "已渗试件 < 3，按国标记为未达到",
      };
    }
    return { grade: undefined, gradeLabel: "—", reason: "尚未录入" };
  }
  // 1 或 2 个渗水：未达到
  return {
    grade: undefined,
    gradeLabel: `未达到 P${permeatedPressures.length >= 1 ? Math.round(permeatedPressures[permeatedPressures.length - 1]! * 10) : "n"}`,
    reason: "已渗试件 < 3，按国标记为未达到",
  };
}
