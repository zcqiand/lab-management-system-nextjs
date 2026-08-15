import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'
import { requirementLabel } from './DefaultParamCard'
import {
  parseTensileRecord,
  recomputeStrengths,
  meanOfSpecimen,
  REBAR_DIAMETER_MM,
  type TensileSpecimen,
} from './rebar-welding'

/** 断裂特征枚举（按 JGJ/T 27-2014 习惯）。 */
const FRACTURE_OPTIONS = ['母材断裂', '焊缝断裂', '热影响区断裂', '其他']

/** 均值 vs 技术要求 → 合格/不合格；无法判定返回 ''。 */
function autoVerdict(
  mean: number | undefined,
  req: InspectionTechnicalRequirement | undefined,
): '合格' | '不合格' | '' {
  if (mean === undefined || !req) return ''
  const { comparison, minValue, maxValue, valueType } = req
  if (comparison === '≥' && minValue != null) return mean >= minValue ? '合格' : '不合格'
  if (comparison === '≤' && maxValue != null) return mean <= maxValue ? '合格' : '不合格'
  if ((comparison === 'range' || valueType === 'range') && minValue != null && maxValue != null)
    return mean >= minValue && mean <= maxValue ? '合格' : '不合格'
  return ''
}

const MANUAL_VERDICTS = ['合格', '不合格'] as const

/**
 * 钢筋焊接接头抗拉强度卡（IP-0087）：1 样品 = 3 试件（JGJ/T 27-2014 §6.1）。
 * 顶部共享：规格 Φ22（硬编码）+ 技术要求。下方 3 行：最大荷重(kN) → 抗拉强度(MPa) / 断口距(mm) / 断裂特征。
 * 抗拉强度 Rm = 4000·F/(π·d²)，d=22mm 硬编码（规格 Φ22，参数界面层不再录入）；
 * JGJ/T 27 无 ±10% 剔除，均值=3 试件算术平均。
 */
export function RebarWeldingTensileCard({
  parameter: p,
  record,
  sampleId,
  techReqs,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const initial = useMemo(() => parseTensileRecord(record?.result), [record?.result])
  const [spec, setSpec] = useState<TensileSpecimen>(initial)

  // 切换样品时重置本地状态
  useEffect(() => {
    setSpec(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 sampleId/result 引用变化时重置
  }, [sampleId, record?.result])

  // 仅取已核验的技术要求
  const reqOptions = useMemo(
    () => techReqs.filter((r) => r.verificationStatus === 'verified'),
    [techReqs],
  )

  const mean = useMemo(() => meanOfSpecimen(spec), [spec])
  const req = reqOptions.find((r) => r.id === spec.techReqId) ?? reqOptions[0]
  const verdict = autoVerdict(mean, req)

  const emit = (next: TensileSpecimen) => {
    onChange({
      result: JSON.stringify(next),
    })
  }

  const update = (patch: Partial<TensileSpecimen>) => {
    if (readOnly) return
    setSpec((prev) => recomputeStrengths({ ...prev, ...patch }))
    emit(recomputeStrengths({ ...spec, ...patch }))
  }

  const updateLoad = (t: 0 | 1 | 2, v: number) => {
    if (readOnly) return
    const loads: [number, number, number] = [...spec.loads] as [number, number, number]
    loads[t] = Number.isFinite(v) ? v : 0
    update({ loads })
  }
  const updateDistance = (t: 0 | 1 | 2, v: number) => {
    if (readOnly) return
    const fractureDistances: [number, number, number] = [...spec.fractureDistances] as [
      number,
      number,
      number,
    ]
    fractureDistances[t] = Number.isFinite(v) ? v : 0
    update({ fractureDistances })
  }
  const updateFracture = (t: 0 | 1 | 2, v: string) => {
    if (readOnly) return
    const fractureCharacteristics: [string, string, string] = [...spec.fractureCharacteristics] as [
      string,
      string,
      string,
    ]
    fractureCharacteristics[t] = v
    update({ fractureCharacteristics })
  }
  const updateReq = (reqId: string) => {
    if (readOnly) return
    const r = reqOptions.find((x) => x.id === reqId)
    update({
      techReqId: reqId,
      techReqLabel: r ? requirementLabel(r) : '',
    })
  }
  const handleOverallVerdict = (v: string) => {
    onChange({ verdict: v })
  }

  const verdictClass =
    verdict === '合格' ? 'text-green-600' : verdict === '不合格' ? 'text-red-600' : 'text-gray-400'

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
          {verdict ? (
            <span className={verdictClass}>{verdict}</span>
          ) : (
            <select
              value={record?.verdict ?? ''}
              onChange={(e) => handleOverallVerdict(e.target.value)}
              disabled={readOnly}
              aria-label="整体单项评定"
              className="border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">未评定</option>
              {MANUAL_VERDICTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs bg-gray-50 rounded p-2">
        <span className="text-gray-500" aria-label="公称直径（硬编码）">
          规格 Φ{REBAR_DIAMETER_MM}
          <span className="ml-1 text-gray-400">（硬编码，不录入）</span>
        </span>
        <span className="text-gray-500">
          技术要求
          <select
            value={spec.techReqId}
            onChange={(e) => updateReq(e.target.value)}
            disabled={readOnly}
            aria-label="技术要求"
            className="ml-1 border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">未选</option>
            {reqOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {requirementLabel(r)}
              </option>
            ))}
          </select>
        </span>
      </div>

      <table className="w-full text-xs">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-1 w-6">#</th>
            <th className="text-left py-1">最大荷重 (kN)</th>
            <th className="text-left py-1">抗拉强度 (MPa)</th>
            <th className="text-left py-1">断口距 (mm)</th>
            <th className="text-left py-1">断裂特征</th>
          </tr>
        </thead>
        <tbody>
          {([0, 1, 2] as const).map((t) => {
            const load = spec.loads[t]
            const strength = spec.strengths[t]
            const dist = spec.fractureDistances[t]
            const fc = spec.fractureCharacteristics[t]
            return (
              <tr key={t}>
                <td className="py-1">{t + 1}</td>
                <td className="py-1">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="kN"
                    value={load === 0 ? '' : load}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value)
                      updateLoad(t, Number.isFinite(v) ? v : 0)
                    }}
                    readOnly={readOnly}
                    aria-label={`试件 ${t + 1} 最大荷重`}
                    className="w-24 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                  />
                </td>
                <td className="py-1 text-gray-700">
                  {strength > 0 ? strength.toFixed(1) : '-'}
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="mm"
                    value={dist === 0 ? '' : dist}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value)
                      updateDistance(t, Number.isFinite(v) ? v : 0)
                    }}
                    readOnly={readOnly}
                    aria-label={`试件 ${t + 1} 断口距`}
                    className="w-20 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                  />
                </td>
                <td className="py-1">
                  <select
                    value={fc}
                    onChange={(e) => updateFracture(t, e.target.value)}
                    disabled={readOnly}
                    aria-label={`试件 ${t + 1} 断裂特征`}
                    className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">未选</option>
                    {FRACTURE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="text-xs text-gray-600">
        均值：<span className="font-medium text-gray-900">{mean ?? '—'}</span>
      </div>
    </div>
  )
}

export default RebarWeldingTensileCard