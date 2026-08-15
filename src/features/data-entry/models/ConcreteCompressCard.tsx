import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'

/** 荷载(kN) + 受压面积(mm²) → 抗压强度(MPa) + 代表值(均值)，均保留 2 位。 */
export function computeConcreteCompress(
  loads: number[],
  area: number,
): { strengths: number[]; representative: number | undefined } {
  const strengths = loads
    .filter((v) => v !== null && !Number.isNaN(v))
    .map((v) => Math.round(((v * 1000) / area) * 100) / 100)
  if (strengths.length === 0) return { strengths: [], representative: undefined }
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length
  return { strengths, representative: Math.round(mean * 100) / 100 }
}

function parseRecordResult(raw: string | undefined): {
  loads: number[]
  strengths: number[]
  representative?: number
} {
  if (!raw) return { loads: [], strengths: [] }
  try {
    const obj = JSON.parse(raw) as { loads?: number[]; strengths?: number[]; representative?: number }
    return {
      loads: Array.isArray(obj.loads) ? obj.loads : [],
      strengths: Array.isArray(obj.strengths) ? obj.strengths : [],
      representative: obj.representative,
    }
  } catch {
    return { loads: [], strengths: [] }
  }
}

/**
 * 混凝土抗压强度模型卡：N 试件 × 破坏荷载 → 只读抗压强度 → 代表值=均值。
 * 无技术要求 / 单项评定（抗压强度按代表值评定，不在此卡判定）。
 */
export function ConcreteCompressCard({ parameter: p, record, sampleId, config, onChange, readOnly = false }: ParamModelProps) {
  const specimenCount = (config?.specimenCount as number) ?? 3
  const area = (config?.area as number) ?? 22500
  const initial = useMemo(() => parseRecordResult(record?.result), [record?.result])

  const [loads, setLoads] = useState<number[]>(
    Array.from({ length: specimenCount }, (_, i) => initial.loads[i] ?? 0),
  )
  // 切换样品时（sampleId 变了）→ 重置 loads 到新样品的初始值，
  // 否则旧样品的本地 state 会跨样品污染当前卡片的展示。
  useEffect(() => {
    setLoads(
      Array.from({ length: specimenCount }, (_, i) => initial.loads[i] ?? 0),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 sampleId/result 引用变化（样品切换或落库后）时重置，避免每次 keystroke 重置用户输入
  }, [sampleId, record?.result, specimenCount])

  const representative = useMemo(
    () => computeConcreteCompress(loads, area).representative,
    [loads, area],
  )

  const emit = (nextLoads: number[]) => {
    const { strengths: s, representative: rep } = computeConcreteCompress(nextLoads, area)
    onChange({ result: JSON.stringify({ loads: nextLoads, strengths: s, representative: rep }) })
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm font-medium">
        {p.canonicalName || p.name}
        {p.unit ? `（${p.unit}）` : ''}
      </div>
      <table className="w-full text-xs">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-1">#</th>
            <th className="text-left py-1">破坏荷载 (kN)</th>
            <th className="text-left py-1">抗压强度 (MPa)</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((lv, i) => {
            const strength = lv ? Math.round(((lv * 1000) / area) * 100) / 100 : null
            return (
              <tr key={i}>
                <td className="py-1">{i + 1}</td>
                <td className="py-1">
                  <input
                    type="number"
                    placeholder="破坏荷载 (kN)"
                    value={lv === 0 ? '' : lv}
                    onChange={(e) => {
                      if (readOnly) return
                      const v = e.target.value === '' ? 0 : Number(e.target.value)
                      const next = [...loads]
                      next[i] = v
                      setLoads(next)
                      emit(next)
                    }}
                    readOnly={readOnly}
                    className="w-32 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                  />
                </td>
                <td className="py-1 text-gray-700">{strength ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="text-xs text-gray-600">抗压强度代表值：{representative ?? '—'}</div>
    </div>
  )
}

export default ConcreteCompressCard
