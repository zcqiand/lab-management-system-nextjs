import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'

/** 试件数（混凝土抗渗标准为 6 个圆台试件）。 */
const SPECIMEN_COUNT = 6

/** 渗水情况枚举。 */
type Permeation = '已渗' | '未渗'

interface Specimen {
  pressure: number // MPa；0 = 未填
  permeated: Permeation
}

const EMPTY_SPECIMEN: Specimen = { pressure: 0, permeated: '未渗' }

/**
 * 按 GB/T 50082-2009 计算抗渗等级：
 * 6 个试件中第 3 个渗水试件的渗水压力 = 抗渗等级（MPa 数值）。
 * 不足 3 个渗水 → grade=undefined，reason="未达到 Pn"。
 *
 * 返回：
 * - grade：抗渗等级数值（MPa），如 0.8
 * - gradeLabel：展示文本，如 "P8" / "未达到 Pn" / "—"
 * - reason：未达成时的简短理由
 */
export function computeConcretePermeability(specimens: Specimen[]): {
  grade: number | undefined
  gradeLabel: string
  reason: string | undefined
} {
  const permeatedPressures: number[] = []
  for (const s of specimens) {
    if (s.permeated === '已渗' && s.pressure > 0) permeatedPressures.push(s.pressure)
  }
  if (permeatedPressures.length >= 3) {
    // 取第 3 个渗水试件的压力为抗渗等级
    const grade = permeatedPressures[2]!
    return {
      grade,
      gradeLabel: `P${Math.round(grade * 10)}`,
      reason: undefined,
    }
  }
  if (permeatedPressures.length === 0) {
    // 全部未渗：取 6 个试件中的最大试验压力作为"未达到"的上界
    const maxPressure = specimens.reduce((m, s) => Math.max(m, s.pressure), 0)
    if (maxPressure > 0) {
      return {
        grade: undefined,
        gradeLabel: `未达到 P${Math.round(maxPressure * 10)}`,
        reason: '已渗试件 < 3，按国标记为未达到',
      }
    }
    return { grade: undefined, gradeLabel: '—', reason: '尚未录入' }
  }
  // 1 或 2 个渗水：未达到
  return {
    grade: undefined,
    gradeLabel: `未达到 P${permeatedPressures.length >= 1 ? Math.round(permeatedPressures[permeatedPressures.length - 1]! * 10) : 'n'}`,
    reason: '已渗试件 < 3，按国标记为未达到',
  }
}

function parseRecordResult(raw: string | undefined): Specimen[] {
  if (!raw) return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }))
  try {
    const obj = JSON.parse(raw) as { specimens?: Array<{ pressure?: number; permeated?: Permeation }> }
    const list = obj.specimens
    if (!Array.isArray(list)) return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }))
    return Array.from({ length: SPECIMEN_COUNT }, (_, i) => {
      const s = list[i]
      return {
        pressure: typeof s?.pressure === 'number' ? s.pressure : 0,
        permeated: s?.permeated === '已渗' ? '已渗' : '未渗',
      }
    })
  } catch {
    return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }))
  }
}

/**
 * 混凝土抗渗性能模型卡：6 试件 ×（渗水压力 MPa + 渗水情况）→ 抗渗等级（按 GB/T 50082-2009）。
 * 不在卡内判定"合格/不合格"（由技术要求列 + 人工改判决定）。
 */
export function ConcretePermeabilityCard({ parameter: p, record, sampleId, onChange, readOnly = false }: ParamModelProps) {
  const initial = useMemo(() => parseRecordResult(record?.result), [record?.result])
  const [specimens, setSpecimens] = useState<Specimen[]>(initial)

  // 切换样品时（sampleId 变了）→ 重置 specimens 到新样品的初始值，避免跨样品污染
  useEffect(() => {
    setSpecimens(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 sampleId/result 引用变化（样品切换或落库后）时重置
  }, [sampleId, record?.result])

  const { gradeLabel, reason } = useMemo(() => computeConcretePermeability(specimens), [specimens])

  const emit = (next: Specimen[]) => {
    // gradeLabel 必须落库：105_混凝土抗渗性能检测报告 的「判定」列通过
    // srecord:<n>:IP-0190:gradeLabel 取数（P8 / 未达到 P8），只存 grade 数值取不到该文案。
    const { grade, gradeLabel, reason: nextReason } = computeConcretePermeability(next)
    onChange({
      result: JSON.stringify({
        specimens: next,
        grade,
        gradeLabel,
        reason: grade === undefined ? nextReason : undefined,
      }),
    })
  }

  const updatePressure = (i: number, v: number) => {
    if (readOnly) return
    const next = specimens.map((s, idx) => (idx === i ? { ...s, pressure: v } : s))
    setSpecimens(next)
    emit(next)
  }

  const updatePermeated = (i: number, v: Permeation) => {
    if (readOnly) return
    const next = specimens.map((s, idx) => (idx === i ? { ...s, permeated: v } : s))
    setSpecimens(next)
    emit(next)
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
            <th className="text-left py-1">渗水压力 (MPa)</th>
            <th className="text-left py-1">渗水情况</th>
          </tr>
        </thead>
        <tbody>
          {specimens.map((s, i) => (
            <tr key={i}>
              <td className="py-1">{i + 1}</td>
              <td className="py-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="渗水压力 (MPa)"
                  value={s.pressure === 0 ? '' : s.pressure}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : Number(e.target.value)
                    updatePressure(i, Number.isFinite(v) ? v : 0)
                  }}
                  readOnly={readOnly}
                  aria-label={`试件 ${i + 1} 渗水压力`}
                  className="w-32 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                />
              </td>
              <td className="py-1">
                <select
                  value={s.permeated}
                  onChange={(e) => updatePermeated(i, e.target.value as Permeation)}
                  disabled={readOnly}
                  aria-label={`试件 ${i + 1} 渗水情况`}
                  className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="未渗">未渗</option>
                  <option value="已渗">已渗</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-600">
        抗渗等级：<span className="font-medium text-gray-900">{gradeLabel}</span>
        {reason && <span className="ml-2 text-gray-500">（{reason}）</span>}
      </div>
    </div>
  )
}

export default ConcretePermeabilityCard