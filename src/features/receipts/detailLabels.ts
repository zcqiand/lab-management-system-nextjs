import type { InspectionParameter, InspectionReportName } from '@/types/api'
import type { InspectionStandard } from '@/types/inspection'

/**
 * 检测参数显示标签：名称(单位)。
 * unit 为空只显示名称，不带空括号；未知 code 回退显示 code 本身。
 */
export function paramLabel(code: string | undefined, parameters: InspectionParameter[]): string {
  if (!code) return '—'
  const p = parameters.find((x) => x.code === code)
  const name = p?.name ?? code
  return p?.unit ? `${name}(${p.unit})` : name
}

/**
 * 报告类别显示标签：报告简称（InspectionReportName.name）。
 * 老 categoryCode 找不到映射时回退显示原编码，避免空白。
 */
export function categoryLabel(code: string, reportNames: InspectionReportName[]): string {
  return reportNames.find((r) => r.code === code)?.name ?? code
}

/**
 * 检测标准显示标签：标准编号 + 名称（中间空一格）。
 * 未知 code 回退显示原编码，避免空白——不编造「空名称」。
 */
export function standardLabel(code: string, standards: InspectionStandard[]): string {
  const s = standards.find((x) => x.code === code)
  if (!s) return code
  return s.name ? `${s.code} ${s.name}` : s.code
}

/**
 * 批量：把多个标准编码渲染成逗号串，每项 code + name。
 */
export function standardLabels(codes: string[] | undefined, standards: InspectionStandard[]): string {
  if (!codes || codes.length === 0) return '—'
  return codes.map((c) => standardLabel(c, standards)).join(', ')
}
