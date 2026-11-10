// 算法域：颗粒级配（ADR-0056 从 ParticleGradationCard 提炼的纯函数）。
// 砂 / 碎（卵）石（GB/T 14684 / GB/T 14685）：
//   累计筛余 = 前 i 项分计筛余累加；
//   细度模数 M_x = (∑ 累计筛余前 6 孔) / (100 − 筛底累计筛余)；
//   平均 = 各样品每孔分计筛余的均值（>0 才计入）。

export const SIEVE_COLS_SAND = [
  "4.75mm",
  "2.36mm",
  "1.18mm",
  "0.60mm",
  "0.30mm",
  "0.15mm",
  "筛底",
];

export const SIEVE_COLS_GRAVEL = [
  "90mm",
  "75mm",
  "63mm",
  "53mm",
  "37.5mm",
  "31.5mm",
  "26.5mm",
  "19mm",
  "16mm",
  "9.5mm",
  "4.75mm",
  "2.36mm",
];

/** schema params → 当前筛孔列头（gravel 走石列，否则砂列；columnOptions* 可覆盖）。 */
export function sieveColumns(params: Record<string, unknown>): string[] {
  const gravel = params["gravel"] === true;
  const key = gravel ? "columnOptionsGravel" : "columnOptionsSand";
  const fromParams = params[key];
  if (Array.isArray(fromParams) && fromParams.length > 0) {
    return fromParams.filter((s): s is string => typeof s === "string");
  }
  return gravel ? SIEVE_COLS_GRAVEL : [...SIEVE_COLS_SAND];
}

export function computeCumulative(retainedPct: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of retainedPct) {
    acc += Number(v) || 0;
    out.push(Math.round(acc * 100) / 100);
  }
  return out;
}

export function computeFinenessModulus(
  cumulativePct: number[],
  sieveCount: number,
): number {
  // GB/T 14684 砂：前 6 个累计筛余之和 / (100 − 筛底累计筛余)
  const topSix = cumulativePct.slice(0, Math.min(6, sieveCount - 1));
  const sum = topSix.reduce((a, b) => a + b, 0);
  const bottom = cumulativePct[sieveCount - 1] ?? 0;
  if (bottom >= 100) return 0;
  return Math.round((sum / (100 - bottom)) * 100) / 100;
}

/** 各行第 c 列有效值（>0）均值，圆整 0.1；全空 → 0。 */
export function averageByCol(rows: number[][]): number[] {
  if (rows.length === 0) return [];
  const len = rows[0]!.length;
  const out: number[] = [];
  for (let c = 0; c < len; c++) {
    let s = 0;
    let n = 0;
    for (const r of rows) {
      const v = Number(r[c]);
      if (Number.isFinite(v) && v > 0) {
        s += v;
        n++;
      }
    }
    out.push(n > 0 ? Math.round((s / n) * 10) / 10 : 0);
  }
  return out;
}
