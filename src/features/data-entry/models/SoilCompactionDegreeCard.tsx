import { useEffect, useMemo, useState } from 'react'
import type { ParamModelProps } from './types'

/**
 * 土工压实度录入卡（componentPath = soil-compaction-degree）
 *
 * 覆盖 RN-109-2 灌砂法 与 RN-109-3 环刀法两份报告——两者录入列一致，
 * 只是环刀法报告里逐行显示「最大干密度」列（config.showMaxDensityColumn）。
 *
 * 录入：试样编号 / 取样部位 / 层次 / 设计压实度 % / 湿密度 g/cm³ / 含水率 %
 * 自动：干密度 = 湿密度 ÷ (1 + 含水率/100)
 *       压实度 = 干密度 ÷ 最大干密度 × 100
 *       单项评定 = 压实度 ≥ 设计压实度 ? 合格 : 不合格
 *
 * 落库形状（109_土工压实度检测报告（灌砂法/环刀法）.inject.json 按此取数）：
 * {
 *   maxDryDensity: number,
 *   rows: [{ code, part, layer, designDegree, wetDensity, moisture,
 *            dryDensity, degree, verdict }, ...]
 * }
 * 模板取 `record:IP-0456:rows[i].<field>`。
 */

export interface CompactionDegreeRow {
  code: string
  part: string
  layer: string
  /** 设计压实度 (%) */
  designDegree: number
  /** 湿密度 (g/cm³) */
  wetDensity: number
  /** 含水率 (%) */
  moisture: number
}

export interface CompactionDegreeComputed extends CompactionDegreeRow {
  /** 干密度 (g/cm³)；无法计算 = 0 */
  dryDensity: number
  /** 压实度 (%)；无法计算 = 0 */
  degree: number
  /** 单项评定；缺数据 = '' */
  verdict: '合格' | '不合格' | ''
  /** 该行对应的最大干密度（环刀法逐行显示用） */
  maxDryDensity: number
}

const DEFAULT_ROW_COUNT = 6

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

const EMPTY_ROW: CompactionDegreeRow = {
  code: '',
  part: '',
  layer: '',
  designDegree: 0,
  wetDensity: 0,
  moisture: 0,
}

/** 干密度 / 压实度 / 评定。缺任一必需输入 → 该项为 0 / ''。 */
export function computeCompactionDegree(
  row: CompactionDegreeRow,
  maxDryDensity: number,
): { dryDensity: number; degree: number; verdict: '合格' | '不合格' | '' } {
  if (!(row.wetDensity > 0) || !(row.moisture >= 0)) {
    return { dryDensity: 0, degree: 0, verdict: '' }
  }
  const dryDensity = round(row.wetDensity / (1 + row.moisture / 100), 3)
  if (!(maxDryDensity > 0)) return { dryDensity, degree: 0, verdict: '' }
  const degree = round((dryDensity / maxDryDensity) * 100, 1)
  const verdict: '合格' | '不合格' | '' =
    row.designDegree > 0 ? (degree >= row.designDegree ? '合格' : '不合格') : ''
  return { dryDensity, degree, verdict }
}

interface ParsedState {
  maxDryDensity: number
  rows: CompactionDegreeRow[]
}

function parseResult(raw: string | undefined, count: number): ParsedState {
  const empty = (): ParsedState => ({
    maxDryDensity: 0,
    rows: Array.from({ length: count }, () => ({ ...EMPTY_ROW })),
  })
  if (!raw || !raw.trimStart().startsWith('{')) return empty()
  try {
    const obj = JSON.parse(raw) as {
      maxDryDensity?: number
      rows?: Array<Partial<CompactionDegreeRow>>
    }
    const src = Array.isArray(obj.rows) ? obj.rows : []
    return {
      maxDryDensity: Number(obj.maxDryDensity) || 0,
      rows: Array.from({ length: Math.max(count, src.length) }, (_, i) => ({
        code: String(src[i]?.code ?? ''),
        part: String(src[i]?.part ?? ''),
        layer: String(src[i]?.layer ?? ''),
        designDegree: Number(src[i]?.designDegree) || 0,
        wetDensity: Number(src[i]?.wetDensity) || 0,
        moisture: Number(src[i]?.moisture) || 0,
      })),
    }
  } catch {
    return empty()
  }
}

export function SoilCompactionDegreeCard({
  parameter: param,
  record,
  sampleId,
  config,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const cfg = (config ?? {}) as { rowCount?: number; showMaxDensityColumn?: boolean }
  const count = Number(cfg.rowCount) || DEFAULT_ROW_COUNT
  const showMaxCol = cfg.showMaxDensityColumn === true

  const initial = useMemo(
    () => parseResult(record?.result, count),
    [record?.result, count],
  )
  const [state, setState] = useState<ParsedState>(initial)

  useEffect(() => {
    setState(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅切换样品/落库后重置，避免覆盖正在输入的值
  }, [sampleId, record?.result, count])

  const computed: CompactionDegreeComputed[] = useMemo(
    () =>
      state.rows.map((r) => ({
        ...r,
        ...computeCompactionDegree(r, state.maxDryDensity),
        maxDryDensity: state.maxDryDensity,
      })),
    [state],
  )

  const emit = (next: ParsedState) => {
    const rows = next.rows.map((r) => ({
      ...r,
      ...computeCompactionDegree(r, next.maxDryDensity),
      maxDryDensity: next.maxDryDensity,
    }))
    // 整卡评定：任一行不合格即不合格；全部未录入则不上报 verdict（留给人工）
    const filled = rows.filter((r) => r.verdict !== '')
    const overall = filled.length === 0 ? undefined : filled.every((r) => r.verdict === '合格') ? '合格' : '不合格'
    onChange({
      result: JSON.stringify({ maxDryDensity: next.maxDryDensity, rows }),
      ...(overall ? { verdict: overall } : {}),
    })
  }

  const updateRow = (
    i: number,
    field: keyof CompactionDegreeRow,
    v: string | number,
  ) => {
    if (readOnly) return
    const next: ParsedState = {
      ...state,
      rows: state.rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)),
    }
    setState(next)
    emit(next)
  }

  const updateMax = (v: number) => {
    if (readOnly) return
    const next: ParsedState = { ...state, maxDryDensity: Number.isFinite(v) ? v : 0 }
    setState(next)
    emit(next)
  }

  const cellCls = 'border px-1 py-1 text-center'
  const numCls =
    'w-20 border rounded px-1 py-0.5 text-right disabled:bg-gray-100 disabled:text-gray-500'
  const txtCls =
    'w-24 border rounded px-1 py-0.5 disabled:bg-gray-100 disabled:text-gray-500'

  return (
    <div className="border rounded p-3 space-y-3" data-fn="M03.F03.I03">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{param.canonicalName || param.name}</span>
        <label className="text-xs text-gray-600">
          最大干密度（g/cm³）：
          <input
            type="number"
            step="0.001"
            aria-label="最大干密度"
            className={`${numCls} ml-1`}
            disabled={readOnly}
            value={state.maxDryDensity || ''}
            onChange={(e) => updateMax(Number(e.target.value))}
          />
        </label>
      </div>

      <table className="text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className={cellCls}>试样编号</th>
            <th className={cellCls}>取样部位</th>
            <th className={cellCls}>层次</th>
            <th className={cellCls}>设计压实度（%）</th>
            <th className={cellCls}>湿密度（g/cm³）</th>
            <th className={cellCls}>含水率（%）</th>
            <th className={cellCls}>干密度（g/cm³）</th>
            {showMaxCol && <th className={cellCls}>最大干密度（g/cm³）</th>}
            <th className={cellCls}>压实度（%）</th>
            <th className={cellCls}>单项评定</th>
          </tr>
        </thead>
        <tbody>
          {computed.map((r, i) => (
            <tr key={i}>
              <td className={cellCls}>
                <input
                  aria-label={`第 ${i + 1} 行试样编号`}
                  className={txtCls}
                  disabled={readOnly}
                  value={r.code}
                  onChange={(e) => updateRow(i, 'code', e.target.value)}
                />
              </td>
              <td className={cellCls}>
                <input
                  aria-label={`第 ${i + 1} 行取样部位`}
                  className={txtCls}
                  disabled={readOnly}
                  value={r.part}
                  onChange={(e) => updateRow(i, 'part', e.target.value)}
                />
              </td>
              <td className={cellCls}>
                <input
                  aria-label={`第 ${i + 1} 行层次`}
                  className={txtCls}
                  disabled={readOnly}
                  value={r.layer}
                  onChange={(e) => updateRow(i, 'layer', e.target.value)}
                />
              </td>
              <td className={cellCls}>
                <input
                  type="number"
                  step="0.1"
                  aria-label={`第 ${i + 1} 行设计压实度`}
                  className={numCls}
                  disabled={readOnly}
                  value={r.designDegree || ''}
                  onChange={(e) => updateRow(i, 'designDegree', Number(e.target.value))}
                />
              </td>
              <td className={cellCls}>
                <input
                  type="number"
                  step="0.001"
                  aria-label={`第 ${i + 1} 行湿密度`}
                  className={numCls}
                  disabled={readOnly}
                  value={r.wetDensity || ''}
                  onChange={(e) => updateRow(i, 'wetDensity', Number(e.target.value))}
                />
              </td>
              <td className={cellCls}>
                <input
                  type="number"
                  step="0.1"
                  aria-label={`第 ${i + 1} 行含水率`}
                  className={numCls}
                  disabled={readOnly}
                  value={r.moisture || ''}
                  onChange={(e) => updateRow(i, 'moisture', Number(e.target.value))}
                />
              </td>
              <td className={cellCls} data-testid={`dry-density-${i}`}>
                {r.dryDensity || '—'}
              </td>
              {showMaxCol && (
                <td className={cellCls}>{r.maxDryDensity || '—'}</td>
              )}
              <td className={cellCls} data-testid={`degree-${i}`}>
                {r.degree || '—'}
              </td>
              <td
                className={`${cellCls} ${r.verdict === '不合格' ? 'text-red-600' : r.verdict === '合格' ? 'text-green-600' : 'text-gray-400'}`}
                data-testid={`verdict-${i}`}
              >
                {r.verdict || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
