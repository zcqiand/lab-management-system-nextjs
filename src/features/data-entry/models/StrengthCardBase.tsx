import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'
import type { TestRecord } from '@/types/process/test-record'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'
import { requirementLabel } from './DefaultParamCard'
import { autoVerdict, parseStrengthRecord, type StrengthResult } from './cement-strength'

const MANUAL_VERDICTS = ['合格', '不合格'] as const

export interface StrengthCardProps extends ParamModelProps {
  /** 试件数（抗折 3 / 抗压 6）。 */
  specimenCount: number
  /** 荷载(kN) → StrengthResult 的计算函数（含 ±10% 剔除）。 */
  compute: (loads: number[]) => StrengthResult
  /** 强度列表头，如「抗折强度 (MPa)」。 */
  strengthLabel: string
}

/**
 * 水泥胶砂强度卡（抗折/抗压共用）：
 * N 试件 × 破坏荷载(kN) → 只读强度(MPa) → ±10% 剔除均值 → 单项评定。
 * 评定：有 verified 技术要求时按均值自动判；否则回退手选（合格/不合格）。
 */
export function StrengthCardBase({
  parameter: p,
  record,
  sampleId,
  techReqs,
  compute,
  specimenCount,
  strengthLabel,
  onChange,
  readOnly = false,
}: StrengthCardProps) {
  const initial = useMemo(() => parseStrengthRecord(record?.result), [record?.result])
  const [loads, setLoads] = useState<number[]>(
    Array.from({ length: specimenCount }, (_, i) => initial.loads[i] ?? 0),
  )

  // 切换样品(sampleId 变)或落库(result 变)时重置本地荷载，避免跨样品污染。
  useEffect(() => {
    setLoads(Array.from({ length: specimenCount }, (_, i) => initial.loads[i] ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 sampleId/result 引用变化时重置，避免每次 keystroke 清空输入
  }, [sampleId, record?.result, specimenCount])

  // 仅取已核验的技术要求参与自动判；无则回退手选。
  const reqOptions = useMemo(
    () => techReqs.filter((r) => r.verificationStatus === 'verified'),
    [techReqs],
  )
  const [reqId, setReqId] = useState<string>(record?.requirementCode ?? reqOptions[0]?.id ?? '')
  const selectedReq: InspectionTechnicalRequirement | undefined = reqOptions.find((r) => r.id === reqId)

  const { strengths, kept, mean, invalid } = useMemo(() => compute(loads), [compute, loads])
  const verdict = reqOptions.length > 0 ? autoVerdict(mean, selectedReq ?? reqOptions[0]) : record?.verdict ?? ''

  const emit = (nextLoads: number[], nextReqId: string, manualVerdict?: string) => {
    const res = compute(nextLoads)
    const req = reqOptions.find((r) => r.id === nextReqId) ?? reqOptions[0]
    const patch: Partial<TestRecord> = {
      result: JSON.stringify({
        loads: nextLoads,
        strengths: res.strengths,
        kept: res.kept,
        mean: res.mean,
        invalid: res.invalid,
      }),
    }
    if (reqOptions.length > 0) {
      patch.verdict = autoVerdict(res.mean, req)
      patch.requirementCode = nextReqId
      patch.requirement = req ? requirementLabel(req) : ''
    } else if (manualVerdict !== undefined) {
      patch.verdict = manualVerdict
    }
    onChange(patch)
  }

  const verdictClass =
    verdict === '合格' ? 'text-green-600' : verdict === '不合格' ? 'text-red-600' : 'text-gray-400'

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {p.canonicalName || p.name}
          {p.unit ? `（${p.unit}）` : ''}
        </span>
        <span className={`text-xs ${verdictClass}`}>{verdict || '未评定'}</span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-1">#</th>
            <th className="text-left py-1">破坏荷载 (kN)</th>
            <th className="text-left py-1">{strengthLabel}</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((lv, i) => {
            const s = strengths[i]
            const discarded = lv > 0 && !kept[i]
            return (
              <tr key={i}>
                <td className="py-1">{i + 1}</td>
                <td className="py-1">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="破坏荷载 (kN)"
                    value={lv === 0 ? '' : lv}
                    onChange={(e) => {
                      if (readOnly) return
                      const v = e.target.value === '' ? 0 : Number(e.target.value)
                      const next = [...loads]
                      next[i] = Number.isFinite(v) ? v : 0
                      setLoads(next)
                      emit(next, reqId)
                    }}
                    readOnly={readOnly}
                    aria-label={`试件 ${i + 1} 破坏荷载`}
                    className="w-32 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                  />
                </td>
                <td className={`py-1 ${discarded ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {lv > 0 ? s : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="text-xs text-gray-600">
        强度平均值：<span className="font-medium text-gray-900">{mean ?? '—'}</span>
        {invalid && <span className="ml-2 text-red-500">（离群值超 ±10%，按 GB/T 17671 结果作废）</span>}
      </div>
      {reqOptions.length > 0 ? (
        <div className="text-xs">
          <label className="text-gray-500 mr-1">技术要求</label>
          <select
            value={reqId}
            onChange={(e) => {
              if (readOnly) return
              setReqId(e.target.value)
              emit(loads, e.target.value)
            }}
            disabled={readOnly}
            className="border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            {reqOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {requirementLabel(r)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-xs">
          <label className="text-gray-500 mr-1">单项评定</label>
          <select
            value={record?.verdict ?? ''}
            onChange={(e) => {
              if (readOnly) return
              emit(loads, reqId, e.target.value)
            }}
            disabled={readOnly}
            className="border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">未评定</option>
            {MANUAL_VERDICTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
