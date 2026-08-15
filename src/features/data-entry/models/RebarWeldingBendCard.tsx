import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'
import {
  parseBendRecord,
  type BendSpecimen,
} from './rebar-welding'

/** 弯曲试验结果枚举（JGJ/T 27-2014 习惯）。 */
const BEND_RESULTS = ['合格', '不合格'] as const

/**
 * 钢筋焊接接头弯曲性能卡（IP-0155）：1 样品 = 3 试件（JGJ/T 27-2014 §6.2）。
 * 3 行 = 弯曲角度(deg) + 合格/不合格。
 */
export function RebarWeldingBendCard({
  parameter: p,
  record,
  sampleId,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const initial = useMemo(() => parseBendRecord(record?.result), [record?.result])
  const [spec, setSpec] = useState<BendSpecimen>(initial)

  // 切换样品时重置
  useEffect(() => {
    setSpec(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 sampleId/result 引用变化时重置
  }, [sampleId, record?.result])

  // 整体评定：3 件全合格 → 合格；任一不合格 → 不合格；其余 → ''
  const overall: '合格' | '不合格' | '' = useMemo(() => {
    if (spec.results.some((r) => r === '不合格')) return '不合格'
    if (spec.results.every((r) => r === '合格')) return '合格'
    return ''
  }, [spec.results])

  const emit = (next: BendSpecimen) => {
    onChange({
      result: JSON.stringify(next),
      // 自动判覆盖手选；无自动判时不动 record.verdict（让用户在 record 顶层手选）
      ...(overall ? { verdict: overall } : {}),
    })
  }

  const update = (patch: Partial<BendSpecimen>) => {
    if (readOnly) return
    setSpec((prev) => ({ ...prev, ...patch }))
    emit({ ...spec, ...patch })
  }

  const updateAngle = (t: 0 | 1 | 2, v: number) => {
    if (readOnly) return
    const angles: [number, number, number] = [...spec.angles] as [number, number, number]
    angles[t] = Number.isFinite(v) ? v : 0
    update({ angles })
  }

  const updateResult = (t: 0 | 1 | 2, v: string) => {
    if (readOnly) return
    const results: [string, string, string] = [...spec.results] as [string, string, string]
    results[t] = v
    update({ results })
  }

  const handleOverallVerdict = (v: string) => {
    onChange({ verdict: v })
  }

  const overallClass =
    overall === '合格' ? 'text-green-600' : overall === '不合格' ? 'text-red-600' : 'text-gray-400'

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {p.canonicalName || p.name}
          {p.unit ? `（${p.unit}）` : ''}
          <span className="ml-2 text-xs text-gray-500">
            3 试件 / JGJ/T 27-2014
          </span>
        </span>
        <span className="text-xs">
          {overall ? (
            <span className={overallClass}>{overall}</span>
          ) : (
            <select
              value={record?.verdict ?? ''}
              onChange={(e) => handleOverallVerdict(e.target.value)}
              disabled={readOnly}
              aria-label="整体单项评定"
              className="border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">未评定</option>
              {BEND_RESULTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </span>
      </div>

      <table className="w-full text-xs">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-1 w-6">#</th>
            <th className="text-left py-1">弯曲角度 (°)</th>
            <th className="text-left py-1">弯曲结果</th>
          </tr>
        </thead>
        <tbody>
          {([0, 1, 2] as const).map((t) => (
            <tr key={t}>
              <td className="py-1">{t + 1}</td>
              <td className="py-1">
                <input
                  type="number"
                  step="1"
                  placeholder="90"
                  value={spec.angles[t] === 0 ? '' : spec.angles[t]}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : Number(e.target.value)
                    updateAngle(t, Number.isFinite(v) ? v : 0)
                  }}
                  readOnly={readOnly}
                  aria-label={`试件 ${t + 1} 弯曲角度`}
                  className="w-20 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                />
              </td>
              <td className="py-1">
                <select
                  value={spec.results[t]}
                  onChange={(e) => updateResult(t, e.target.value)}
                  disabled={readOnly}
                  aria-label={`试件 ${t + 1} 弯曲结果`}
                  className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {BEND_RESULTS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RebarWeldingBendCard