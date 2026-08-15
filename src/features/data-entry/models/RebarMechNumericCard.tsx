import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParamModelProps } from './types'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'
import { requirementLabel } from './DefaultParamCard'
import { autoVerdict } from './cement-strength'
import {
  parseRebarMechResult,
  computeStrengths,
  ratioTensileOverYield,
  ratioMeasuredOverSpec,
  meanOf,
  rounderFor,
  type RebarMechResult,
  type RebarMechFormula,
} from './rebar-mechanics'

const MANUAL_VERDICTS = ['合格', '不合格'] as const

interface NumericConfig {
  formulaKey?: RebarMechFormula
  specimenCount?: number
  needsDiameter?: boolean
  inputLabel?: string
  valueLabel?: string
  /** 机械连接模式：每试件录入「断裂位置」下拉，存到 result.fractureLocations[N] */
  connectionMode?: boolean
  fractureLocationOptions?: string[]
}

/**
 * 钢筋力学性能 / 机械连接 通用多组数值卡（componentPath = rebar-mech-numeric）。
 * 组数由 calcRule.specimenCount 驱动（回退 config.specimenCount → 2）。行为由 config.formulaKey 决定：
 * - tensile_strength / yield_strength：每组 最大力(kN) + 公称直径 → 强度 R=4000·F/(π·d²)（无断口距/断裂特征）
 * - passthrough：每组直接录入数值（断后伸长率 / 最大力总伸长率，%）
 * - ratio_tensile_over_yield（强屈比）：抗拉[i]/屈服[i]，由同样品 IP-0087/IP-0086 记录联立自动算；缺值回退手动
 * - ratio_measured_over_spec_yield（超强比）：实测屈服[i]/标准屈服值（IP-0086 技术要求 minValue）
 * 均值 vs 已核验技术要求 → 自动单项评定；无法判定时人工评定。
 */
export function RebarMechNumericCard({
  parameter: p,
  record,
  sampleId,
  techReqs,
  config,
  calcRule,
  crossRecord,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const cfg = (config ?? {}) as NumericConfig
  const formula: RebarMechFormula = cfg.formulaKey ?? 'passthrough'
  const count = cfg.specimenCount ?? calcRule?.specimenCount ?? 2
  const needsDiameter = !!cfg.needsDiameter
  const inputLabel = cfg.inputLabel ?? '数值'
  const connectionMode = !!cfg.connectionMode
  const fractureLocationOptions = cfg.fractureLocationOptions ?? ['母材断裂', '断于接头', '热影响区断裂', '其他']
  const round = rounderFor(formula)
  const isStrength = formula === 'tensile_strength' || formula === 'yield_strength'
  const isRatio =
    formula === 'ratio_tensile_over_yield' || formula === 'ratio_measured_over_spec_yield'

  const initial = useMemo(() => parseRebarMechResult(record?.result, count), [record?.result, count])
  const [state, setState] = useState<RebarMechResult>(initial)
  useEffect(() => {
    setState(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在样品切换/落库后重置，避免每次输入被覆盖
  }, [sampleId, record?.result, count])

  const reqOptions = useMemo(
    () => techReqs.filter((r) => r.verificationStatus === 'verified'),
    [techReqs],
  )
  const req: InspectionTechnicalRequirement | undefined =
    reqOptions.find((r) => r.id === state.techReqId) ?? reqOptions[0]

  // 比值卡的自动联立值（抗拉/屈服 或 实测屈服/标准屈服）；缺跨记录数据 → null（回退手动录入）
  const autoStrengths = useMemo<number[] | null>(() => {
    if (formula === 'ratio_tensile_over_yield') {
      const t = crossRecord?.tensileStrengths
      const y = crossRecord?.yieldStrengths
      if (t && y && t.some((v) => v > 0) && y.some((v) => v > 0))
        return ratioTensileOverYield(t, y, count)
    }
    if (formula === 'ratio_measured_over_spec_yield') {
      const y = crossRecord?.yieldStrengths
      const spec = crossRecord?.specStandardYield
      if (y && spec && spec > 0 && y.some((v) => v > 0)) return ratioMeasuredOverSpec(y, spec, count)
    }
    return null
  }, [formula, crossRecord, count])
  const autoMode = autoStrengths !== null

  // 有效结果数组：强度=载荷+直径算；比值自动=联立；其余=录入值本身
  const strengths = useMemo<number[]>(() => {
    if (isStrength) return computeStrengths(state.loads, state.diameter ?? 0)
    if (autoMode) return autoStrengths as number[]
    return state.loads.slice(0, count).map((v) => (Number.isFinite(v) && v > 0 ? round(v) : 0))
  }, [isStrength, autoMode, autoStrengths, state.loads, state.diameter, count, round])
  const mean = useMemo(() => meanOf(strengths, round), [strengths, round])
  const verdict = autoVerdict(mean, req)

  const buildResult = (next: RebarMechResult, nextStrengths: number[]): RebarMechResult => ({
    ...next,
    strengths: nextStrengths,
    mean: meanOf(nextStrengths, round),
  })

  const emit = (next: RebarMechResult, nextStrengths: number[]) => {
    const result = buildResult(next, nextStrengths)
    const v = autoVerdict(result.mean, req)
    onChange({ result: JSON.stringify(result), ...(v ? { verdict: v } : {}) })
  }

  const updateFractureLocation = (i: number, value: string) => {
    const nextLocs = Array.from({ length: count }, (_, j) => state.fractureLocations?.[j] ?? '')
    nextLocs[i] = value
    const next = { ...state, fractureLocations: nextLocs }
    setState(next)
    emit(next, strengths)
  }

  // 自动比值：跨记录数据就绪或变化时把联立结果落进 dirty 缓冲（用序列化 dep 防重复触发）。
  const autoKey = autoMode ? JSON.stringify(autoStrengths) : ''
  const lastAuto = useRef<string>('')
  useEffect(() => {
    if (readOnly || !autoMode) return
    if (lastAuto.current === autoKey) return
    lastAuto.current = autoKey
    emit(state, autoStrengths as number[])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在联立结果变化时同步一次
  }, [autoKey, autoMode, readOnly])

  const updateDiameter = (v: number) => {
    if (readOnly) return
    const next = { ...state, diameter: Number.isFinite(v) ? v : 0 }
    setState(next)
    emit(next, computeStrengths(next.loads, next.diameter ?? 0))
  }
  const updateLoad = (i: number, v: number) => {
    if (readOnly || autoMode) return
    const loads = [...state.loads]
    loads[i] = Number.isFinite(v) ? v : 0
    const next = { ...state, loads }
    const ns = isStrength
      ? computeStrengths(loads, next.diameter ?? 0)
      : loads.slice(0, count).map((x) => (Number.isFinite(x) && x > 0 ? round(x) : 0))
    setState(next)
    emit(next, ns)
  }
  const updateReq = (reqId: string) => {
    if (readOnly) return
    const r = reqOptions.find((x) => x.id === reqId)
    const next = { ...state, techReqId: reqId, techReqLabel: r ? requirementLabel(r) : '' }
    setState(next)
    emit(next, strengths)
  }
  const handleManualVerdict = (v: string) => onChange({ verdict: v })

  const verdictClass =
    verdict === '合格' ? 'text-green-600' : verdict === '不合格' ? 'text-red-600' : 'text-gray-400'

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {p.canonicalName || p.name}
          {p.unit ? `（${p.unit}）` : ''}
          <span className="ml-2 text-xs text-gray-500">
            {count} 组{isRatio ? (autoMode ? ' / 自动计算' : ' / 手动录入') : ''}
          </span>
        </span>
        <span className="text-xs">
          {verdict ? (
            <span className={verdictClass}>{verdict}</span>
          ) : (
            <select
              value={record?.verdict ?? ''}
              onChange={(e) => handleManualVerdict(e.target.value)}
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
        {needsDiameter && (
          <span className="text-gray-500">
            直径 d (mm)
            <input
              type="number"
              step="0.1"
              placeholder="直径"
              value={state.diameter === 0 || state.diameter === undefined ? '' : state.diameter}
              onChange={(e) => updateDiameter(e.target.value === '' ? 0 : Number(e.target.value))}
              readOnly={readOnly}
              aria-label="公称直径"
              className="ml-1 w-24 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
            />
          </span>
        )}
        <span className="text-gray-500">
          技术要求
          <select
            value={state.techReqId}
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
            {!isRatio && !isStrength && <th className="text-left py-1">{inputLabel}</th>}
            {isStrength && <th className="text-left py-1">{inputLabel}</th>}
            {isStrength && <th className="text-left py-1">强度 (MPa)</th>}
            {isRatio && <th className="text-left py-1">比值</th>}
            {connectionMode && <th className="text-left py-1">断裂位置</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, i) => {
            const load = state.loads[i] ?? 0
            const val = strengths[i] ?? 0
            const manualRatio = isRatio && !autoMode
            return (
              <tr key={i}>
                <td className="py-1">{i + 1}</td>
                {(isStrength || (!isRatio && !isStrength) || manualRatio) && (
                  <td className="py-1">
                    <input
                      type="number"
                      step={isRatio ? '0.01' : '0.01'}
                      placeholder={inputLabel}
                      value={load === 0 ? '' : load}
                      onChange={(e) => updateLoad(i, e.target.value === '' ? 0 : Number(e.target.value))}
                      readOnly={readOnly}
                      aria-label={`第 ${i + 1} 组 ${inputLabel}`}
                      className="w-28 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
                    />
                  </td>
                )}
                {isStrength && <td className="py-1 text-gray-700">{val > 0 ? val.toFixed(1) : '-'}</td>}
                {isRatio && autoMode && (
                  <td className="py-1 text-gray-700">{val > 0 ? val.toFixed(2) : '-'}</td>
                )}
                {connectionMode && (
                  <td className="py-1">
                    <select
                      value={state.fractureLocations?.[i] ?? ''}
                      onChange={(e) => updateFractureLocation(i, e.target.value)}
                      disabled={readOnly}
                      aria-label={`第 ${i + 1} 试件断裂位置`}
                      className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">—</option>
                      {fractureLocationOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="text-xs text-gray-600">
        均值：<span className="font-medium text-gray-900">{mean ?? '—'}</span>
        {isStrength && (state.diameter ?? 0) <= 0 && (
          <span className="ml-2 text-orange-500">（需填公称直径以计算强度）</span>
        )}
        {isRatio && !autoMode && (
          <span className="ml-2 text-orange-500">（同样品抗拉/屈服未录入，暂手动填写比值）</span>
        )}
      </div>
    </div>
  )
}

export default RebarMechNumericCard
