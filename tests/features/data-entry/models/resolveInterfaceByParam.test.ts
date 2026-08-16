import { describe, it, expect } from 'vitest'
import { resolveInterfaceByParam } from '@/features/data-entry/models/resolveInterfaceByParam'

const interfaces = [
  { code: 'default', componentPath: 'default', sortOrder: 10 },
  { code: 'cc', componentPath: 'concrete-compress', sortOrder: 5, config: { specimenCount: 3, area: 22500 } },
  { code: 'cc100', componentPath: 'concrete-compress', sortOrder: 20, config: { specimenCount: 3, area: 10000 } },
]

describe('resolveInterfaceByParam', () => {
  it('一个参数绑一个界面 → 返回其 componentPath + config', () => {
    const r = resolveInterfaceByParam(interfaces, [{ inspectionParameterCode: 'IP-1', inspectionParamInterfaceCode: 'cc' }])
    expect(r['IP-1']).toEqual({ componentPath: 'concrete-compress', config: { specimenCount: 3, area: 22500 } })
  })
  it('一个参数绑多个 → 取 sortOrder 最小的界面', () => {
    const r = resolveInterfaceByParam(interfaces, [
      { inspectionParameterCode: 'IP-1', inspectionParamInterfaceCode: 'cc100' },
      { inspectionParameterCode: 'IP-1', inspectionParamInterfaceCode: 'cc' },
    ])
    expect(r['IP-1']!.componentPath).toBe('concrete-compress')
    expect((r['IP-1']!.config as { area: number }).area).toBe(22500) // cc (sortOrder 5) 胜出
  })
  it('未绑的参数不出现', () => {
    const r = resolveInterfaceByParam(interfaces, [])
    expect(r['IP-9']).toBeUndefined()
  })
  it('link 指向不存在的界面 → 忽略', () => {
    const r = resolveInterfaceByParam(interfaces, [{ inspectionParameterCode: 'IP-1', inspectionParamInterfaceCode: 'ghost' }])
    expect(r['IP-1']).toBeUndefined()
  })
})

describe('resolveInterfaceByParam 报告作用域', () => {
  const ifaces = [
    { code: 'weld', componentPath: 'rebar-welding-tensile', sortOrder: 6 },
    { code: 'mech', componentPath: 'rebar-mech-numeric', sortOrder: 8, config: { formulaKey: 'tensile_strength' } },
    { code: 'conn', componentPath: 'rebar-mech-numeric', sortOrder: 9, config: { formulaKey: 'tensile_strength', connection: true } },
  ]
  const links = [
    { inspectionParameterCode: 'IP-0087', inspectionParamInterfaceCode: 'weld' }, // 通用（无作用域）= 焊接兜底
    { inspectionParameterCode: 'IP-0087', inspectionParamInterfaceCode: 'mech', reportNameCode: 'RN-102-1' },
    { inspectionParameterCode: 'IP-0087', inspectionParamInterfaceCode: 'conn', reportNameCode: 'RN-102-2' },
  ]
  it('力学性能报告(RN-102-1) → 力学卡', () => {
    const r = resolveInterfaceByParam(ifaces, links, 'RN-102-1')
    expect(r['IP-0087']!.componentPath).toBe('rebar-mech-numeric')
    expect((r['IP-0087']!.config as { connection?: boolean }).connection).toBeUndefined()
  })
  it('机械连接报告(RN-102-2) → 连接卡', () => {
    const r = resolveInterfaceByParam(ifaces, links, 'RN-102-2')
    expect((r['IP-0087']!.config as { connection?: boolean }).connection).toBe(true)
  })
  it('焊接报告(RN-102-3) 无作用域命中 → 退回通用焊接卡', () => {
    const r = resolveInterfaceByParam(ifaces, links, 'RN-102-3')
    expect(r['IP-0087']!.componentPath).toBe('rebar-welding-tensile')
  })
  it('无 categoryCode → 退回通用关联', () => {
    const r = resolveInterfaceByParam(ifaces, links)
    expect(r['IP-0087']!.componentPath).toBe('rebar-welding-tensile')
  })
})
