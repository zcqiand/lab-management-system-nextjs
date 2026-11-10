// 算法域：土工击实 / 压实度（ADR-0056 从 SoilCompactionCard / SoilCompactionDegreeCard
// 提炼的纯函数）。

export interface CompactionPoint {
  /** 含水率 (%)；0 = 未填 */
  moisture: number;
  /** 干密度 (g/cm³)；0 = 未填 */
  dryDensity: number;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * 击实曲线峰值（GB/T 50123-2019）。
 * ≥3 个有效点时对峰值点及其左右邻点做二次拟合取顶点（标准做法，避免把
 * 离散实测点的最大值直接当峰值）；拟合退化（开口向上或分母为 0）或点数不足时
 * 回退到实测最大干密度点。
 */
export function computeCompactionPeak(points: CompactionPoint[]): {
  maxDryDensity: number | undefined;
  optimalMoisture: number | undefined;
} {
  const valid = points.filter((p) => p.dryDensity > 0 && p.moisture > 0);
  if (valid.length === 0) return { maxDryDensity: undefined, optimalMoisture: undefined };

  const sorted = [...valid].sort((a, b) => a.moisture - b.moisture);
  let peakIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.dryDensity > sorted[peakIdx]!.dryDensity) peakIdx = i;
  }
  const peak = sorted[peakIdx]!;
  const fallback = {
    maxDryDensity: round(peak.dryDensity, 3),
    optimalMoisture: round(peak.moisture, 1),
  };

  // 峰值在端点或点数不足 → 无法三点拟合
  if (sorted.length < 3 || peakIdx === 0 || peakIdx === sorted.length - 1)
    return fallback;

  const [p1, p2, p3] = [sorted[peakIdx - 1]!, peak, sorted[peakIdx + 1]!];
  const [x1, y1] = [p1.moisture, p1.dryDensity];
  const [x2, y2] = [p2.moisture, p2.dryDensity];
  const [x3, y3] = [p3.moisture, p3.dryDensity];
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  if (denom === 0) return fallback;

  const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
  // a >= 0 → 开口向上/退化为直线，没有极大值
  if (a >= 0) return fallback;
  const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom;
  const c =
    (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) /
    denom;
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;

  // 拟合顶点必须落在三点区间内且不低于实测峰值，否则不可信 → 回退
  if (vertexX < x1 || vertexX > x3 || vertexY < peak.dryDensity) return fallback;
  return { maxDryDensity: round(vertexY, 3), optimalMoisture: round(vertexX, 1) };
}

export interface CompactionDegreeRow {
  code: string;
  part: string;
  layer: string;
  /** 设计压实度 (%) */
  designDegree: number;
  /** 湿密度 (g/cm³) */
  wetDensity: number;
  /** 含水率 (%) */
  moisture: number;
}

export interface CompactionDegreeComputed extends CompactionDegreeRow {
  /** 干密度 (g/cm³)；无法计算 = 0 */
  dryDensity: number;
  /** 压实度 (%)；无法计算 = 0 */
  degree: number;
  /** 单项评定；缺数据 = '' */
  verdict: "合格" | "不合格" | "";
  /** 该行对应的最大干密度（环刀法逐行显示用） */
  maxDryDensity: number;
}

/** 干密度 / 压实度 / 评定。缺任一必需输入 → 该项为 0 / ''。 */
export function computeCompactionDegree(
  row: CompactionDegreeRow,
  maxDryDensity: number,
): { dryDensity: number; degree: number; verdict: "合格" | "不合格" | "" } {
  if (!(row.wetDensity > 0) || !(row.moisture >= 0)) {
    return { dryDensity: 0, degree: 0, verdict: "" };
  }
  const dryDensity = round(row.wetDensity / (1 + row.moisture / 100), 3);
  if (!(maxDryDensity > 0)) return { dryDensity, degree: 0, verdict: "" };
  const degree = round((dryDensity / maxDryDensity) * 100, 1);
  const verdict: "合格" | "不合格" | "" =
    row.designDegree > 0 ? (degree >= row.designDegree ? "合格" : "不合格") : "";
  return { dryDensity, degree, verdict };
}
