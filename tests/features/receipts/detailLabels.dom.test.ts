import { describe, expect } from 'vitest'
import { fnTest } from '../../fn'
import { paramLabel, categoryLabel } from '@/features/receipts/detailLabels'
import type { InspectionParameter, InspectionReportName } from '@/types/api'

const params = (overrides: Partial<InspectionParameter>[] = []): InspectionParameter[] =>
  overrides.map((o, i) => ({
    id: `p-${i}`,
    code: o.code ?? 'IP-0001',
    name: o.name ?? '凝结时间',
    unit: o.unit,
  }) as unknown as InspectionParameter)

const reportNames = (overrides: Partial<InspectionReportName>[] = []): InspectionReportName[] =>
  overrides.map((o, i) => ({
    id: `rn-${i}`,
    code: o.code ?? 'RN-103-3',
    name: o.name ?? '水泥物理性能试验报告',
  }) as unknown as InspectionReportName)

describe('详情页显示标签', () => {
  fnTest(['M03.F09.I02'], '检测参数：有 unit 显示 名称(单位)', () => {
    const ps = params([{ code: 'IP-0001', name: '凝结时间', unit: 'h' }])
    expect(paramLabel('IP-0001', ps)).toBe('凝结时间(h)')
  })

  fnTest(['M03.F09.I02'], '检测参数：unit 为空只显示名称，不带空括号', () => {
    const ps = params([{ code: 'IP-0002', name: '抗压强度', unit: '' }])
    expect(paramLabel('IP-0002', ps)).toBe('抗压强度')
  })

  fnTest(['M03.F09.I02'], '检测参数：unit 缺省只显示名称', () => {
    const ps = params([{ code: 'IP-0003', name: '密度' }])
    expect(paramLabel('IP-0003', ps)).toBe('密度')
  })

  fnTest(['M03.F09.I02'], '检测参数：未知 code 回退显示 code，无 IP-前缀拼接', () => {
    expect(paramLabel('IP-9999', params())).toBe('IP-9999')
  })

  fnTest(['M03.F09.I02'], '检测参数：code 为空显示 —', () => {
    expect(paramLabel(undefined, params())).toBe('—')
  })

  fnTest(['M03.F09.I02'], '报告类别：命中报告名称显示简称', () => {
    const rns = reportNames([{ code: 'RN-103-3', name: '水泥物理性能试验报告' }])
    expect(categoryLabel('RN-103-3', rns)).toBe('水泥物理性能试验报告')
  })

  fnTest(['M03.F09.I02'], '报告类别：老 categoryCode 找不到回退显示原编码', () => {
    expect(categoryLabel('OLD-CODE', reportNames())).toBe('OLD-CODE')
  })
})
