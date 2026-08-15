import type { ParamModelProps } from './types'
import type { TestRecord } from '@/types/process/test-record'
import type { InspectionStandard } from '@/types/inspection/inspection-standard'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'

const VERDICT_OPTIONS = ['合格', '不合格', '符合', '不符合'] as const
type Verdict = (typeof VERDICT_OPTIONS)[number]

export function requirementLabel(r: InspectionTechnicalRequirement): string {
  const unit = r.unit ? ` ${r.unit}` : ''
  if (((r.valueType === 'range') || (r.comparison === 'range')) && r.minValue != null && r.maxValue != null)
    return `${r.minValue} ~ ${r.maxValue}${unit}`
  if (r.comparison === '≥' && r.minValue != null) return `≥ ${r.minValue}${unit}`
  if (r.comparison === '≤' && r.maxValue != null) return `≤ ${r.maxValue}${unit}`
  if (r.targetValue) return `${r.comparison === '=' || r.comparison === 'eq' ? '= ' : ''}${r.targetValue}${unit}`
  if (r.expression) return r.expression
  const parts = [r.comparison, r.minValue ?? r.maxValue ?? r.targetValue].filter(Boolean).join(' ')
  return parts ? `${parts}${unit}` : r.remark || '—'
}

export function DefaultParamCard({ parameter: p, record: rec, standards, stdParams, techReqs, onChange, readOnly = false }: ParamModelProps) {
  const basisOptions = stdParams
    .filter((sp) => sp.inspectionParameterCode === p.code)
    .map((sp) => standards.find((s) => s.code === sp.inspectionStandardCode))
    .filter((s): s is InspectionStandard => !!s)
  const reqOptions = techReqs.filter((r) => r.inspectionParameterCode === p.code)
  const inputVal = rec?.result ?? ''
  const basisVal = rec?.standardCode ?? ''
  const reqVal = rec?.requirementCode ?? ''
  const verdictVal = rec?.verdict ?? ''
  const passLabel = (r?: TestRecord) => {
    if (!r) return <span className="text-gray-400">未录入</span>
    if (r.verdict === '合格' || r.verdict === '符合') return <span className="text-green-600">{r.verdict}</span>
    if (r.verdict === '不合格' || r.verdict === '不符合') return <span className="text-red-600">{r.verdict}</span>
    return <span className="text-gray-400">未评定</span>
  }
  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{p.canonicalName || p.name}{p.unit ? `（${p.unit}）` : ''}</span>
        <span className="text-xs">{passLabel(rec)}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
        <div>
          <label className="block text-gray-500 mb-0.5">检测依据</label>
          <select
            value={basisVal}
            onChange={(e) => onChange({ standardCode: e.target.value })}
            disabled={readOnly}
            className="w-full border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">—</option>
            {basisOptions.map((s) => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">技术要求</label>
          <select
            value={reqVal}
            onChange={(e) => onChange({ requirementCode: e.target.value, requirement: requirementLabel(reqOptions.find((r) => r.id === e.target.value) ?? reqOptions[0]!) })}
            disabled={readOnly}
            className="w-full border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">{rec?.requirement && !reqVal ? rec.requirement : '—'}</option>
            {reqOptions.map((r) => <option key={r.id} value={r.id}>{requirementLabel(r)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">检测结果</label>
          <input
            value={inputVal}
            onChange={(e) => onChange({ result: e.target.value })}
            placeholder="录入检测结果"
            readOnly={readOnly}
            className="w-full border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">单项评定</label>
          <select
            value={verdictVal}
            onChange={(e) => onChange({ verdict: e.target.value as Verdict })}
            disabled={readOnly}
            className="w-full border rounded px-1 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">未评定</option>
            {VERDICT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export default DefaultParamCard
