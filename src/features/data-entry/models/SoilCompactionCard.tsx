import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'

/**
 * 土工击实录入卡（componentPath = soil-compaction）
 *
 * GB/T 50123-2019《土工试验方法标准》击实试验：一组试样在不同含水率下击实，
 * 得到 N 组（含水率 %，干密度 g/cm³）；击实曲线峰值即 最大干密度 / 最优含水率。
 *
 * 落库形状（109_土工击实检测报告.inject.json 按此取数）：
 * {
 *   points: [{ moisture: number, dryDensity: number }, ...],
 *   maxDryDensity: number,   // 峰值干密度（g/cm³）
 *   optimalMoisture: number  // 峰值对应含水率（%）
 * }
 * 模板取 `record:IP-0226:points[i].dryDensity` / `points[i].moisture`
 * 与 `record:IP-0226:maxDryDensity` / `optimalMoisture`。
 */

export interface CompactionPoint {
  /** 含水率 (%)；0 = 未填 */
  moisture: number
  /** 干密度 (g/cm³)；0 = 未填 */
  dryDensity: number
}

export interface CompactionResult {
  points: CompactionPoint[]
  maxDryDensity: number | undefined
  optimalMoisture: number | undefined
}

const DEFAULT_POINT_COUNT = 5

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/**
 * 击实曲线峰值。
 *
 * ≥3 个有效点时对峰值点及其左右邻点做二次拟合取顶点（标准做法，避免把
 * 离散实测点的最大值直接当峰值）；拟合退化（开口向上或分母为 0）或点数不足时
 * 回退到实测最大干密度点。
 */
export function computeCompactionPeak(points: CompactionPoint[]): {
  maxDryDensity: number | undefined
  optimalMoisture: number | undefined
} {
  const valid = points.filter((p) => p.dryDensity > 0 && p.moisture > 0)
  if (valid.length === 0) return { maxDryDensity: undefined, optimalMoisture: undefined }

  const sorted = [...valid].sort((a, b) => a.moisture - b.moisture)
  let peakIdx = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.dryDensity > sorted[peakIdx]!.dryDensity) peakIdx = i
  }
  const peak = sorted[peakIdx]!
  const fallback = {
    maxDryDensity: round(peak.dryDensity, 3),
    optimalMoisture: round(peak.moisture, 1),
  }

  // 峰值在端点或点数不足 → 无法三点拟合
  if (sorted.length < 3 || peakIdx === 0 || peakIdx === sorted.length - 1) return fallback

  const [p1, p2, p3] = [sorted[peakIdx - 1]!, peak, sorted[peakIdx + 1]!]
  const [x1, y1] = [p1.moisture, p1.dryDensity]
  const [x2, y2] = [p2.moisture, p2.dryDensity]
  const [x3, y3] = [p3.moisture, p3.dryDensity]
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3)
  if (denom === 0) return fallback

  const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom
  // a >= 0 → 开口向上/退化为直线，没有极大值
  if (a >= 0) return fallback
  const b =
    (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom
  const c =
    (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) /
    denom
  const vertexX = -b / (2 * a)
  const vertexY = a * vertexX * vertexX + b * vertexX + c

  // 拟合顶点必须落在三点区间内且不低于实测峰值，否则不可信 → 回退
  if (vertexX < x1 || vertexX > x3 || vertexY < peak.dryDensity) return fallback
  return { maxDryDensity: round(vertexY, 3), optimalMoisture: round(vertexX, 1) }
}

function parseResult(raw: string | undefined, count: number): CompactionPoint[] {
  const empty = () =>
    Array.from({ length: count }, () => ({ moisture: 0, dryDensity: 0 }))
  if (!raw || !raw.trimStart().startsWith('{')) return empty()
  try {
    const obj = JSON.parse(raw) as { points?: Array<Partial<CompactionPoint>> }
    if (!Array.isArray(obj.points)) return empty()
    return Array.from({ length: count }, (_, i) => ({
      moisture: Number(obj.points?.[i]?.moisture) || 0,
      dryDensity: Number(obj.points?.[i]?.dryDensity) || 0,
    }))
  } catch {
    return empty()
  }
}

export function SoilCompactionCard({
  parameter: param,
  record,
  sampleId,
  config,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const count = Number((config as { pointCount?: number } | undefined)?.pointCount) ||
    DEFAULT_POINT_COUNT

  const initial = useMemo(
    () => parseResult(record?.result, count),
    [record?.result, count],
  )
  const [points, setPoints] = useState<CompactionPoint[]>(initial)

  useEffect(() => {
    setPoints(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅切换样品/落库后重置，避免覆盖正在输入的值
  }, [sampleId, record?.result, count])

  const peak = useMemo(() => computeCompactionPeak(points), [points])

  const emit = (next: CompactionPoint[]) => {
    const { maxDryDensity, optimalMoisture } = computeCompactionPeak(next)
    const result: CompactionResult = { points: next, maxDryDensity, optimalMoisture }
    onChange({ result: JSON.stringify(result) })
  }

  const update = (i: number, field: keyof CompactionPoint, v: number) => {
    if (readOnly) return
    const next = points.map((p, idx) =>
      idx === i ? { ...p, [field]: Number.isFinite(v) ? v : 0 } : p,
    )
    setPoints(next)
    emit(next)
  }

  const cellCls = 'border px-2 py-1 text-center'
  const inputCls =
    'w-20 border rounded px-1 py-0.5 text-right disabled:bg-gray-100 disabled:text-gray-500'

  return (
    <div className="border rounded p-3 space-y-3" data-fn="M03.F03.I03">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{param.canonicalName || param.name}</span>
        <span className="text-xs text-gray-500">GB/T 50123-2019 击实试验</span>
      </div>

      <table className="text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className={cellCls}>序号</th>
            {points.map((_, i) => (
              <th key={i} className={cellCls}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cellCls}>含水率（%）</td>
            {points.map((p, i) => (
              <td key={i} className={cellCls}>
                <input
                  type="number"
                  step="0.1"
                  aria-label={`第 ${i + 1} 组含水率`}
                  className={inputCls}
                  disabled={readOnly}
                  value={p.moisture || ''}
                  onChange={(e) => update(i, 'moisture', Number(e.target.value))}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={cellCls}>干密度（g/cm³）</td>
            {points.map((p, i) => (
              <td key={i} className={cellCls}>
                <input
                  type="number"
                  step="0.001"
                  aria-label={`第 ${i + 1} 组干密度`}
                  className={inputCls}
                  disabled={readOnly}
                  value={p.dryDensity || ''}
                  onChange={(e) => update(i, 'dryDensity', Number(e.target.value))}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="flex gap-6 text-sm">
        <span>
          最大干密度（g/cm³）：
          <b data-testid="max-dry-density">{peak.maxDryDensity ?? '—'}</b>
        </span>
        <span>
          最优含水率（%）：
          <b data-testid="optimal-moisture">{peak.optimalMoisture ?? '—'}</b>
        </span>
      </div>
    </div>
  )
}
