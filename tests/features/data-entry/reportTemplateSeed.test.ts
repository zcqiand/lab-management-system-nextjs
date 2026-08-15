import { describe, it, expect } from 'vitest'
import { mockResult, inferUnit, requirementFor } from '@/features/data-entry/reportTemplateSeed'

describe('reportTemplateSeed', () => {
  it('同 parameterCode 确定性输出', () => {
    expect(mockResult('IP-0001')).toEqual(mockResult('IP-0001'))
  })

  it('不同 parameterCode 产生不同检测值', () => {
    // 排除巧合：两个真实 code 的 jcz 不应相等
    expect(mockResult('IP-0001').jcz).not.toEqual(mockResult('IP-0086').jcz)
  })

  it('inferUnit 按关键字推断', () => {
    expect(inferUnit('抗压强度')).toBe('MPa')
    expect(inferUnit('含泥量')).toBe('%')
    expect(inferUnit('凝结时间')).toBe('min')
    expect(inferUnit('细度模数')).toBe('') // 无匹配规则
    expect(inferUnit('密度')).toBe('kg/m³')
    expect(inferUnit('氯离子含量')).toBe('%') // 含量 → %
    expect(inferUnit('屈服强度')).toBe('MPa')
    expect(inferUnit('直径')).toBe('mm')
  })

  it('requirementFor 对 5 条真技术要求返回 comparison + 边界值', () => {
    // IP-0086 屈服强度 ≥400
    expect(requirementFor('IP-0086').jz).toBe('≥ 400')
    expect(requirementFor('IP-0086').req?.minValue).toBe(400)
    // IP-0087 抗拉强度 ≥540
    expect(requirementFor('IP-0087').jz).toBe('≥ 540')
    // IP-0055 抗压强度 ≥30
    expect(requirementFor('IP-0055').jz).toBe('≥ 30')
    // IP-0004 氯离子 ≤0.06
    expect(requirementFor('IP-0004').jz).toBe('≤ 0.06')
    // IP-0171 含泥量：find() 取数组首个匹配（Ⅱ类 细骨料 砂 ≤ 3）
    expect(requirementFor('IP-0171').jz).toBe('≤ 3')
  })

  it('requirementFor 无技术要求时返回模板化描述且 req 为 undefined', () => {
    const r = requirementFor('IP-0001')
    expect(r.req).toBeUndefined()
    expect(r.jz).toBe('符合相应标准要求')
  })

  it('IP-0086 屈服强度 mock 值 ≥ 400 且单位 MPa 且合格', () => {
    const m = mockResult('IP-0086')
    expect(m.dw).toBe('MPa')
    expect(Number(m.jcz)).toBeGreaterThanOrEqual(400)
    expect(m.jd).toBe('合格')
  })

  it('IP-0004 氯离子 ≤ 上限：mock 值 ≤ 0.06', () => {
    const m = mockResult('IP-0004')
    expect(m.dw).toBe('%')
    expect(Number(m.jcz)).toBeLessThanOrEqual(0.06)
    expect(m.jd).toBe('合格')
  })

  it('IP-0055 抗压强度 单位 MPa 且值落在推断区间 [25,50]', () => {
    const m = mockResult('IP-0055')
    expect(m.dw).toBe('MPa')
    const v = Number(m.jcz)
    expect(v).toBeGreaterThanOrEqual(30) // 真下限
    expect(v).toBeLessThanOrEqual(50)
  })

  it('无技术要求参数：单位按名推断、jd 合格、jcz 非空', () => {
    // IP-0001 凝结时间 → min
    const m = mockResult('IP-0001')
    expect(m.dw).toBe('min')
    expect(m.jd).toBe('合格')
    expect(m.jcz.length).toBeGreaterThan(0)
    const v = Number(m.jcz)
    expect(v).toBeGreaterThanOrEqual(90) // RANGE_RULES 凝结时间 [90,300]
    expect(v).toBeLessThanOrEqual(300)
  })

  it('requirement 参数覆盖内部技术要求文案但不影响数值', () => {
    const plain = mockResult('IP-0086')
    const overridden = mockResult('IP-0086', '客户特别要求 ≥420')
    // 数值仍按真技术要求（≥400）确定性生成
    expect(overridden.jcz).toBe(plain.jcz)
    expect(overridden.dw).toBe(plain.dw)
    expect(overridden.jd).toBe('合格')
  })

  it('未知 code（name 查不到）走 fallback：jcz="—" dw="" jd="合格"', () => {
    const m = mockResult('IP-9999-strong')
    expect(m).toEqual({ jcz: '—', dw: '', jd: '合格' })
  })
})
