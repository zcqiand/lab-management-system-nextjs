import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { RebarMechNumericCard } from '@/features/data-entry/models/RebarMechNumericCard'
import type { ParamModelProps } from '@/features/data-entry/models/types'
import type { InspectionParameter } from '@/types/api'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'

afterEach(() => cleanup())

const param = (code: string, name: string, unit?: string): InspectionParameter =>
  ({ code, name, canonicalName: name, rawName: name, aliases: [], unit, sourceType: 'official', sortOrder: 1, id: code, createdAt: '', updatedAt: '' }) as InspectionParameter

const req = (over: Partial<InspectionTechnicalRequirement>): InspectionTechnicalRequirement =>
  ({ id: 'req-1', inspectionParameterCode: 'IP', judgmentStandardCode: 'GB', valueType: 'numeric', comparison: '≥', minValue: 400, judgmentMode: 'automatic', verificationStatus: 'verified', sortOrder: 1, ...over }) as InspectionTechnicalRequirement

function base(over: Partial<ParamModelProps>): ParamModelProps {
  return {
    parameter: param('IP-0087', '抗拉强度', 'MPa'),
    record: undefined,
    sampleId: 's1',
    standards: [],
    stdParams: [],
    techReqs: [],
    config: {},
    onChange: vi.fn(),
    ...over,
  }
}

describe('RebarMechNumericCard 组数', () => {
  it('按 calcRule.specimenCount 渲染 N 组（2 组，无第 3 行）', () => {
    render(<RebarMechNumericCard {...base({
      config: { formulaKey: 'tensile_strength', needsDiameter: true, inputLabel: '最大力 (kN)' },
      calcRule: { specimenCount: 2 },
    })} />)
    expect(screen.getByLabelText('第 1 组 最大力 (kN)')).toBeTruthy()
    expect(screen.getByLabelText('第 2 组 最大力 (kN)')).toBeTruthy()
    expect(screen.queryByLabelText('第 3 组 最大力 (kN)')).toBeNull()
  })
  it('抗拉卡无断口距 / 断裂特征列', () => {
    render(<RebarMechNumericCard {...base({
      config: { formulaKey: 'tensile_strength', needsDiameter: true, inputLabel: '最大力 (kN)' },
      calcRule: { specimenCount: 2 },
    })} />)
    expect(screen.queryByText('断口距 (mm)')).toBeNull()
    expect(screen.queryByText('断裂特征')).toBeNull()
  })
})

describe('RebarMechNumericCard 抗拉/屈服强度', () => {
  it('填直径 + 最大力 → 抗拉强度 R=4000F/(πd²) 落 onChange', () => {
    const onChange = vi.fn()
    render(<RebarMechNumericCard {...base({
      config: { formulaKey: 'tensile_strength', needsDiameter: true, inputLabel: '最大力 (kN)' },
      calcRule: { specimenCount: 2 },
      onChange,
    })} />)
    fireEvent.change(screen.getByLabelText('公称直径'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('第 1 组 最大力 (kN)'), { target: { value: '100' } })
    const last = onChange.mock.calls.at(-1)![0]
    const result = JSON.parse(last.result)
    expect(result.strengths[0]).toBe(318.3)
    expect(result.mean).toBe(318.3)
  })
  it('已核验技术要求 ≥400 且均值 318.3 → 不合格', () => {
    const onChange = vi.fn()
    render(<RebarMechNumericCard {...base({
      config: { formulaKey: 'tensile_strength', needsDiameter: true, inputLabel: '最大力 (kN)' },
      calcRule: { specimenCount: 2 },
      techReqs: [req({ comparison: '≥', minValue: 400 })],
      onChange,
    })} />)
    fireEvent.change(screen.getByLabelText('公称直径'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('第 1 组 最大力 (kN)'), { target: { value: '100' } })
    const last = onChange.mock.calls.at(-1)![0]
    expect(last.verdict).toBe('不合格')
  })
})

describe('RebarMechNumericCard passthrough（伸长率）', () => {
  it('直接录入值 → 均值', () => {
    const onChange = vi.fn()
    render(<RebarMechNumericCard {...base({
      parameter: param('IP-0150', '断后伸长率', '%'),
      config: { formulaKey: 'passthrough', inputLabel: '断后伸长率 (%)' },
      calcRule: { specimenCount: 2 },
      onChange,
    })} />)
    fireEvent.change(screen.getByLabelText('第 1 组 断后伸长率 (%)'), { target: { value: '18' } })
    fireEvent.change(screen.getByLabelText('第 2 组 断后伸长率 (%)'), { target: { value: '20' } })
    const last = onChange.mock.calls.at(-1)![0]
    const result = JSON.parse(last.result)
    expect(result.mean).toBe(19)
  })
})

describe('RebarMechNumericCard 强屈比 / 超强比', () => {
  it('crossRecord 就绪 → 强屈比自动计算并落 onChange', () => {
    const onChange = vi.fn()
    render(<RebarMechNumericCard {...base({
      parameter: param('IP-0559', '强屈比'),
      config: { formulaKey: 'ratio_tensile_over_yield', valueLabel: '强屈比' },
      calcRule: { specimenCount: 2 },
      crossRecord: { tensileStrengths: [550, 560], yieldStrengths: [430, 440] },
      onChange,
    })} />)
    const last = onChange.mock.calls.at(-1)![0]
    const result = JSON.parse(last.result)
    expect(result.strengths).toEqual([1.28, 1.27])
  })
  it('超强比 = 实测屈服/标准屈服 = 430/400', () => {
    const onChange = vi.fn()
    render(<RebarMechNumericCard {...base({
      parameter: param('IP-0560', '超强比'),
      config: { formulaKey: 'ratio_measured_over_spec_yield', valueLabel: '超强比' },
      calcRule: { specimenCount: 2 },
      crossRecord: { yieldStrengths: [430, 430], specStandardYield: 400 },
      onChange,
    })} />)
    const last = onChange.mock.calls.at(-1)![0]
    const result = JSON.parse(last.result)
    expect(result.strengths).toEqual([1.08, 1.08])
  })
  it('crossRecord 缺失 → 回退手动录入（有输入框）', () => {
    render(<RebarMechNumericCard {...base({
      parameter: param('IP-0559', '强屈比'),
      config: { formulaKey: 'ratio_tensile_over_yield', valueLabel: '强屈比' },
      calcRule: { specimenCount: 2 },
      crossRecord: undefined,
    })} />)
    expect(screen.getByLabelText('第 1 组 数值')).toBeTruthy()
  })
})

describe('RebarMechNumericCard readOnly', () => {
  it('只读 → 输入禁用', () => {
    render(<RebarMechNumericCard {...base({
      config: { formulaKey: 'tensile_strength', needsDiameter: true, inputLabel: '最大力 (kN)' },
      calcRule: { specimenCount: 2 },
      readOnly: true,
    })} />)
    expect((screen.getByLabelText('第 1 组 最大力 (kN)') as HTMLInputElement).readOnly).toBe(true)
  })
})
