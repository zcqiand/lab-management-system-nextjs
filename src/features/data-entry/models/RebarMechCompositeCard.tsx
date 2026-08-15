import { useEffect, useMemo, useState } from 'react'
import type { InspectionParameter, TestRecord } from '@/types/api'
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
  type RebarMechFormula,
} from './rebar-mechanics'

interface CompositeSubConfig {
  parameterCode: string
  /** display 标题（默认取 parameter.name） */
  label?: string
  /** 公式：决定该子段的录入/计算形态 */
  formulaKey: RebarMechFormula
  /** 该子段是否需要「试件组数」（默认 2） */
  specimenCount?: number
  /** 子段输入框 label（默认「数值」） */
  inputLabel?: string
  /** 比值类子段（如强屈比/超强比）可关闭手工录入 */
  autoOnly?: boolean
}

interface CompositeConfig {
  /** 共享的公称直径（mm）；同一卡片内抗拉/屈服共用 */
  shareDiameter?: boolean
  /** 子段配置；缺省用内置默认 6 段 */
  subParams?: CompositeSubConfig[]
  /** 强制按公式分组（输入列分组渲染）；缺省每段独立表 */
  layout?: 'grouped' | 'independent'
}

const DEFAULT_SUB_PARAMS: CompositeSubConfig[] = [
  { parameterCode: 'IP-0087', formulaKey: 'tensile_strength', label: '抗拉强度', inputLabel: '最大力 (kN)' },
  { parameterCode: 'IP-0086', formulaKey: 'yield_strength', label: '屈服强度', inputLabel: '屈服力 (kN)' },
  { parameterCode: 'IP-0150', formulaKey: 'passthrough', label: '断后伸长率', inputLabel: '伸长率 (%)' },
  { parameterCode: 'IP-0097', formulaKey: 'passthrough', label: '最大力总伸长率', inputLabel: '最大力总伸长率 (%)' },
  { parameterCode: 'IP-0559', formulaKey: 'ratio_tensile_over_yield', label: '强屈比', autoOnly: true },
  { parameterCode: 'IP-0560', formulaKey: 'ratio_measured_over_spec_yield', label: '超强比', autoOnly: true },
]

interface SectionState {
  loads: number[]
  diameter: number
  techReqId: string
}

/** 从规格字段（如 "Φ22" / "22mm" / "150×150×150mm"）解析公称直径 d (mm)。失败返回 0。 */
function parseDiameterFromSpec(spec: string | undefined): number {
  if (!spec) return 0
  // 抓第一个整数 / 小数
  const m = spec.match(/(\d+(?:\.\d+)?)/)
  if (!m) return 0
  const v = Number(m[1])
  return Number.isFinite(v) && v > 0 ? v : 0
}

interface SectionRowProps {
  sub: CompositeSubConfig
  parameter: InspectionParameter | undefined
  state: SectionState
  reqOptions: InspectionTechnicalRequirement[]
  crossRecord?: {
    tensileStrengths?: number[]
    yieldStrengths?: number[]
    specStandardYield?: number
  }
  readOnly: boolean
  onLoadChange: (i: number, v: number) => void
  onTechReqChange: (reqId: string) => void
}

function SectionRow({
  sub,
  parameter: p,
  state,
  reqOptions,
  crossRecord,
  readOnly,
  onLoadChange,
  onTechReqChange,
}: SectionRowProps) {
  const formula: RebarMechFormula = sub.formulaKey
  const count = sub.specimenCount ?? 2
  const rounder = rounderFor(formula)
  const isStrength = formula === 'tensile_strength' || formula === 'yield_strength'
  const isRatio =
    formula === 'ratio_tensile_over_yield' || formula === 'ratio_measured_over_spec_yield'
  const autoVals = useMemo<number[] | null>(() => {
    if (!isRatio) return null
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
  }, [formula, isRatio, crossRecord, count])
  const isAuto = autoVals !== null
  const strengths = useMemo<number[]>(() => {
    if (isStrength) return computeStrengths(state.loads, state.diameter || 0)
    if (isAuto) return autoVals as number[]
    return state.loads.slice(0, count).map((v) => (Number.isFinite(v) && v > 0 ? rounder(v) : 0))
  }, [isStrength, isAuto, autoVals, state.loads, state.diameter, count, rounder])
  const mean = meanOf(strengths, rounder)
  const req: InspectionTechnicalRequirement | undefined =
    reqOptions.find((r) => r.id === state.techReqId) ?? reqOptions[0]
  const verdict = autoVerdict(mean, req)
  const verdictClass =
    verdict === '合格'
      ? 'text-green-600'
      : verdict === '不合格'
        ? 'text-red-600'
        : 'text-gray-400'
  const titleLabel = sub.label ?? p?.name ?? sub.parameterCode
  return (
    <div className="border rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">
          {titleLabel}
          {p?.unit ? `（${p.unit}）` : ''}
          <span className="ml-2 text-[10px] text-gray-400">
            {count} 组{isRatio ? (isAuto ? ' / 自动计算' : ' / 手动') : ''}
          </span>
        </span>
        <span className={'text-[10px] ' + verdictClass}>{verdict ?? '未评'}</span>
      </div>
      <table className="w-full text-[11px]">
        <tbody>
          {Array.from({ length: count }, (_, i) => {
            const load = state.loads[i] ?? 0
            const val = strengths[i] ?? 0
            const showInput = !isRatio || !isAuto
            return (
              <tr key={i}>
                <td className="py-0.5 w-5 text-gray-500">{i + 1}</td>
                {showInput && (
                  <td className="py-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={load === 0 ? '' : load}
                      onChange={(e) => onLoadChange(i, e.target.value === '' ? 0 : Number(e.target.value))}
                      readOnly={readOnly}
                      aria-label={`${titleLabel} 第 ${i + 1} 组`}
                      className="w-24 border rounded px-2 py-0.5 text-xs read-only:bg-gray-50 read-only:text-gray-500"
                    />
                  </td>
                )}
                <td className="py-0.5 text-gray-700">
                  {val > 0 ? val.toFixed(2) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="text-[11px] text-gray-600 mt-1">
        均值 <span className="font-medium text-gray-900">{mean ?? '—'}</span>
      </div>
      {!isRatio && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
          技术要求：
          <select
            value={state.techReqId}
            onChange={(e) => onTechReqChange(e.target.value)}
            disabled={readOnly}
            aria-label={`${titleLabel} 技术要求`}
            className="border rounded px-1 py-0.5 text-xs disabled:bg-gray-50"
          >
            <option value="">未选</option>
            {reqOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {requirementLabel(r)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

/**
 * 钢筋力学性能 6 合 1 录入卡（componentPath = rebar-mech-composite）。
 *
 * 把同一样品的 6 个 IP-code（抗拉强度 / 屈服强度 / 断后伸长率 / 最大力总伸长率 /
 * 强屈比 / 超强比）合并为一个录入界面：
 * - 抗拉/屈服共享公称直径 d
 * - 伸长率/最大力总伸长率 各自录入 2 组 passthrough 值
 * - 强屈比/超强比 自动联立（同一样品 IP-0087+IP-0086 + 标准屈服值），缺值回退手动
 * - SaveAll 时按 parameterCode 各自写一行 TestRecord
 */
export function RebarMechCompositeCard({
  parameters,
  recordByParam,
  sampleId,
  techReqs,
  config,
  crossRecord,
  defaultSpec,
  onSave,
  readOnly = false,
}: {
  parameters: InspectionParameter[]
  recordByParam: Map<string, TestRecord>
  sampleId: string
  techReqs: InspectionTechnicalRequirement[]
  config?: Record<string, unknown>
  crossRecord?: {
    tensileStrengths?: number[]
    yieldStrengths?: number[]
    specStandardYield?: number
  }
  /** 样品规格（Φ22 / 22mm），从其中解析公称直径作为初始值。已存盘的手动直径优先。 */
  defaultSpec?: string
  onSave: (sampleId: string, updates: TestRecord[]) => void
  readOnly?: boolean
}) {
  const cfg = config as CompositeConfig | undefined
  const subs: CompositeSubConfig[] = cfg?.subParams ?? DEFAULT_SUB_PARAMS

  const initialByParam = useMemo(() => {
    const map = new Map<string, SectionState>()
    const specDiameter = parseDiameterFromSpec(defaultSpec)
    for (const sub of subs) {
      const rec = recordByParam.get(sub.parameterCode)
      const parsed = parseRebarMechResult(rec?.result, sub.specimenCount ?? 2)
      // 直径：已存盘的 > 0 沿用；否则从样品规格解析
      const stored = parsed.diameter ?? 0
      const diameter = stored > 0 ? stored : specDiameter
      map.set(sub.parameterCode, {
        loads: parsed.loads ?? [],
        diameter,
        techReqId: parsed.techReqId ?? '',
      })
    }
    return map
  }, [subs, recordByParam, defaultSpec])

  const [sections, setSections] = useState<Map<string, SectionState>>(initialByParam)
  useEffect(() => {
    setSections(initialByParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在样品切换/落库后重置，避免每次输入被覆盖
  }, [sampleId, recordByParam])

  const reqByCode = useMemo(
    () => techReqs.filter((r) => r.verificationStatus === 'verified'),
    [techReqs],
  )

  const sharedDiameter = useMemo(() => {
    const t = sections.get('IP-0087')?.diameter ?? 0
    const y = sections.get('IP-0086')?.diameter ?? 0
    return Math.max(t, y)
  }, [sections])

  const setSharedDiameter = (d: number) => {
    if (readOnly) return
    setSections((prev) => {
      const next = new Map(prev)
      for (const code of ['IP-0087', 'IP-0086']) {
        const cur = next.get(code)
        if (cur) next.set(code, { ...cur, diameter: d })
      }
      return next
    })
  }

  const updateLoad = (code: string, i: number, v: number) => {
    if (readOnly) return
    setSections((prev) => {
      const next = new Map(prev)
      const cur = next.get(code)
      if (!cur) return prev
      const loads = [...cur.loads]
      loads[i] = Number.isFinite(v) ? v : 0
      next.set(code, { ...cur, loads })
      return next
    })
  }

  const setTechReq = (code: string, reqId: string) => {
    if (readOnly) return
    setSections((prev) => {
      const next = new Map(prev)
      const cur = next.get(code)
      if (!cur) return prev
      next.set(code, { ...cur, techReqId: reqId })
      return next
    })
  }

  // 共享各子段的 req 选项（按 IP-code 过滤）
  const reqByCodeByParam = useMemo(() => {
    const map = new Map<string, InspectionTechnicalRequirement[]>()
    for (const sub of subs) {
      map.set(
        sub.parameterCode,
        reqByCode.filter((r) => r.inspectionParameterCode === sub.parameterCode),
      )
    }
    return map
  }, [subs, reqByCode])

  const handleSave = () => {
    const updates: TestRecord[] = []
    for (const sub of subs) {
      const state = sections.get(sub.parameterCode) ?? { loads: [], diameter: 0, techReqId: '' }
      const formula = sub.formulaKey
      const count = sub.specimenCount ?? 2
      const rounder = rounderFor(formula)
      const isStrength = formula === 'tensile_strength' || formula === 'yield_strength'
      let strengths: number[]
      if (isStrength) strengths = computeStrengths(state.loads, state.diameter || 0)
      else {
        // 比值卡：优先自动；无自动 → 走 passthrough
        const t = crossRecord?.tensileStrengths
        const y = crossRecord?.yieldStrengths
        const spec = crossRecord?.specStandardYield
        let auto: number[] | null = null
        if (formula === 'ratio_tensile_over_yield' && t && y && t.some((v) => v > 0) && y.some((v) => v > 0))
          auto = ratioTensileOverYield(t, y, count)
        else if (
          formula === 'ratio_measured_over_spec_yield' &&
          y &&
          spec &&
          spec > 0 &&
          y.some((v) => v > 0)
        )
          auto = ratioMeasuredOverSpec(y, spec, count)
        if (auto) strengths = auto
        else
          strengths = state.loads.slice(0, count).map((v) => (Number.isFinite(v) && v > 0 ? rounder(v) : 0))
      }
      const mean = meanOf(strengths, rounder)
      const reqOptions = reqByCode.filter((r) => r.inspectionParameterCode === sub.parameterCode)
      const req = reqOptions.find((r) => r.id === state.techReqId) ?? reqOptions[0]
      const v = autoVerdict(mean, req)
      const result = {
        loads: state.loads,
        diameter: state.diameter,
        strengths,
        mean: meanOf(strengths, rounder),
        techReqId: state.techReqId,
        techReqLabel: req ? requirementLabel(req) : '',
      }
      const existing = recordByParam.get(sub.parameterCode)
      updates.push({
        ...(existing ?? {}),
        id: existing?.id ?? '',
        sampleId,
        parameterCode: sub.parameterCode,
        result: JSON.stringify(result),
        ...(v ? { verdict: v } : {}),
        ...(state.techReqId ? { requirementCode: state.techReqId } : {}),
      } as TestRecord)
    }
    onSave(sampleId, updates)
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">钢筋力学性能</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={readOnly}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          保存全部
        </button>
      </div>
      {cfg?.shareDiameter !== false && (
        <div className="flex items-center gap-2 text-xs bg-gray-50 rounded p-2">
          <span className="text-gray-500">
            公称直径 d (mm){defaultSpec ? `（自动从规格 ${defaultSpec} 取）` : ''}
          </span>
          <input
            type="number"
            step="0.1"
            value={sharedDiameter === 0 ? '' : sharedDiameter}
            onChange={(e) => setSharedDiameter(e.target.value === '' ? 0 : Number(e.target.value))}
            readOnly={readOnly}
            aria-label="共享公称直径"
            className="w-24 border rounded px-2 py-0.5 text-xs read-only:bg-gray-50 read-only:text-gray-500"
          />
          {sharedDiameter === 0 && (
            <span className="ml-2 text-orange-500 text-[10px]">需填直径以计算强度</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {subs.map((s) => {
          const p = parameters.find((x) => x.code === s.parameterCode)
          const state = sections.get(s.parameterCode) ?? { loads: [], diameter: 0, techReqId: '' }
          return (
            <SectionRow
              key={s.parameterCode}
              sub={s}
              parameter={p}
              state={state}
              reqOptions={reqByCodeByParam.get(s.parameterCode) ?? []}
              crossRecord={crossRecord}
              readOnly={readOnly}
              onLoadChange={(i, v) => updateLoad(s.parameterCode, i, v)}
              onTechReqChange={(reqId) => setTechReq(s.parameterCode, reqId)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default RebarMechCompositeCard