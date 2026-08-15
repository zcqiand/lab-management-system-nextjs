import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  tensileStrength,
  recomputeStrengths,
  meanOfSpecimen,
  parseTensileRecord,
  parseBendRecord,
  TRIAL_COUNT,
  EMPTY_TENSILE,
  type TensileSpecimen,
} from '@/features/data-entry/models/rebar-welding'
import { RebarWeldingTensileCard } from '@/features/data-entry/models/RebarWeldingTensileCard'
import { RebarWeldingBendCard } from '@/features/data-entry/models/RebarWeldingBendCard'
import type { ParamModelProps } from '@/features/data-entry/models/types'
import type { InspectionParameter } from '@/types/inspection/inspection-parameter'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'

/** REQ-2026-015：钢筋焊接接头参数界面（抗拉强度 1 样品 = 3 试件 / 弯曲性能 4 试件 × 3 次），JGJ/T 27-2014 公式。 */

const PARAM: InspectionParameter = {
  id: 'p-ip-0087',
  code: 'IP-0087',
  name: '抗拉强度',
  rawName: '抗拉强度',
  canonicalName: '抗拉强度',
  aliases: [],
  sourceType: 'official',
  sortOrder: 0,
  unit: 'MPa',
  createdAt: '2026-07-26',
  updatedAt: '2026-07-26',
}

const REQ: InspectionTechnicalRequirement = {
  id: 'req-540',
  inspectionObjectCode: 'OBJ-SP99',
  inspectionParameterCode: 'IP-0087',
  judgmentStandardCode: 'JGJ/T 27-2014',
  comparison: '≥',
  minValue: 540,
  valueType: 'numeric',
  judgmentMode: 'automatic',
  verificationStatus: 'verified',
  sortOrder: 0,
  remark: 'HRB400 闪光对焊抗拉强度 ≥ 540 MPa',
  createdAt: '2026-07-26',
  updatedAt: '2026-07-26',
}

const BEND_PARAM: InspectionParameter = {
  ...PARAM,
  id: 'p-ip-0155',
  code: 'IP-0155',
  name: '弯曲性能',
  canonicalName: '弯曲性能',
}

function makeProps(over: Partial<ParamModelProps> = {}): ParamModelProps {
  return {
    parameter: PARAM,
    record: undefined,
    sampleId: 's-1',
    standards: [],
    stdParams: [],
    techReqs: [REQ],
    config: undefined,
    onChange: () => {},
    readOnly: false,
    ...over,
  }
}

describe('tensileStrength（JGJ/T 27-2014 Rm=4000·F/(π·d²)）', () => {
  it('d=25mm, F=270kN → 550.0 MPa（HRB400 实测典型值）', () => {
    expect(tensileStrength(270, 25)).toBe(550)
  })
  it('d=20mm, F=160kN → 509.3 MPa', () => {
    expect(tensileStrength(160, 20)).toBe(509.3)
  })
  it('d=32mm, F=440kN → 547.1 MPa', () => {
    expect(tensileStrength(440, 32)).toBe(547.1)
  })
  it('F=0 或 d=0 → 0（按未填）', () => {
    expect(tensileStrength(0, 25)).toBe(0)
    expect(tensileStrength(270, 0)).toBe(0)
  })
  it('非有限数 → 0', () => {
    expect(tensileStrength(NaN, 25)).toBe(0)
    expect(tensileStrength(270, NaN)).toBe(0)
  })
})

describe('recomputeStrengths + meanOfSpecimen', () => {
  it('3 试件用硬编码 Φ22 后 strengths 跟着重算', () => {
    // Φ22 (d=22mm): Rm = 4000·F/(π·22²)
    // F=270 → 4000*270/(π*484) = 710.3
    // F=268 → 4000*268/(π*484) = 705.0
    // F=272 → 4000*272/(π*484) = 715.5
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 268, 272],
    }
    const out = recomputeStrengths(spec)
    expect(out.strengths[0]).toBe(710.3)
    expect(out.strengths[1]).toBe(705)
    expect(out.strengths[2]).toBe(715.5)
  })
  it('meanOfSpecimen 取有效 strength 的算术均值（无剔除，JGJ/T 27 无 ±10% 规则）', () => {
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 268, 272],
      strengths: [710.3, 705, 715.6],
    }
    expect(meanOfSpecimen(spec)).toBe(710.3)
  })
  it('部分荷载缺失 → mean 仅算存在的', () => {
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 0, 272],
      strengths: [710.3, 0, 715.6],
    }
    expect(meanOfSpecimen(spec)).toBe(713)
  })
  it('全空 → undefined', () => {
    expect(meanOfSpecimen(EMPTY_TENSILE)).toBeUndefined()
  })
})

describe('parseTensileRecord 反解析（扁平结构：1 样品 = 3 试件，techReqId 顶层；diameter 字段忽略）', () => {
  it('空 → EMPTY_TENSILE', () => {
    const r = parseTensileRecord(undefined)
    expect(r.loads).toEqual([0, 0, 0])
    expect(r.techReqId).toBe('')
  })
  it('解析失败 → EMPTY_TENSILE', () => {
    const r = parseTensileRecord('{not json}')
    expect(r.loads).toEqual([0, 0, 0])
  })
  it('合法 JSON → 字段逐一读出（diameter 字段被忽略）', () => {
    const raw = JSON.stringify({
      diameter: 25, // 历史数据遗留，应被忽略
      techReqId: 'req-540',
      techReqLabel: '≥ 540 MPa',
      loads: [270, 268, 272],
      strengths: [550, 546, 554.1],
      fractureDistances: [50, 55, 45],
      fractureCharacteristics: ['母材断裂', '母材断裂', '焊缝断裂'],
    })
    const r = parseTensileRecord(raw)
    expect(r.loads).toEqual([270, 268, 272])
    expect(r.fractureCharacteristics).toEqual([
      '母材断裂',
      '母材断裂',
      '焊缝断裂',
    ])
  })
})

describe('parseBendRecord 反解析（扁平结构：1 样品 = 3 试件）', () => {
  it('默认 → EMPTY_BEND', () => {
    const r = parseBendRecord(undefined)
    expect(r.angles).toEqual([90, 90, 90])
    expect(r.results).toEqual(['合格', '合格', '合格'])
  })
  it('合法 JSON → 字段读出', () => {
    const raw = JSON.stringify({ angles: [90, 180, 90], results: ['合格', '不合格', '合格'] })
    const r = parseBendRecord(raw)
    expect(r.results[1]).toBe('不合格')
  })
  it('旧 specimens[] 数组回退 → 取 specimens[0]', () => {
    const raw = JSON.stringify({
      specimens: [{ angles: [90, 180, 90], results: ['合格', '不合格', '合格'] }],
    })
    const r = parseBendRecord(raw)
    expect(r.angles).toEqual([90, 180, 90])
    expect(r.results[1]).toBe('不合格')
  })
})

describe('RebarWeldingTensileCard UI（1 样品 = 3 试件，扁平，规格 Φ22 硬编码）', () => {
  beforeEach(() => cleanup()) // 防上一测试 DOM 残留干扰
  it('空 record → 显示规格 Φ22 硬编码 + 1 共享技术要求 + 3 行输入（无 d 输入框，无「试件 #N」分组）', () => {
    render(<RebarWeldingTensileCard {...makeProps()} />)
    // 规格 Φ22 硬编码：UI 上显示但不录入
    expect(screen.getByText('规格 Φ22')).toBeTruthy()
    expect(screen.getByLabelText('公称直径（硬编码）')).toBeTruthy()
    // 没有「直径」输入框（d 已硬编码，不再录入）
    expect(screen.queryByPlaceholderText('直径')).toBeNull()
    expect(screen.queryByLabelText('公称直径')).toBeNull()
    // 共享技术要求 1 个
    expect(screen.getAllByLabelText('技术要求', { selector: 'select' })).toHaveLength(1)
    // 最大荷重 / 断口距 / 断裂特征 各 3 个（3 试件）
    expect(screen.getAllByLabelText(/最大荷重/)).toHaveLength(TRIAL_COUNT)
    expect(screen.getAllByLabelText(/断口距/)).toHaveLength(TRIAL_COUNT)
    expect(screen.getAllByLabelText(/断裂特征/)).toHaveLength(TRIAL_COUNT)
  })

  it('输入 F=270kN（d 硬编码 Φ22）→ 抗拉强度列显示 710.3 MPa', () => {
    render(<RebarWeldingTensileCard {...makeProps()} />)
    fireEvent.change(screen.getAllByLabelText(/最大荷重/)[0]!, { target: { value: '270' } })
    // 抗拉强度列在 <td class="py-1 text-gray-700"> 里，精确锁定避免与「均值：710.3」混淆
    const strengthCells = document.querySelectorAll('td.py-1.text-gray-700')
    expect(strengthCells[0]?.textContent).toBe('710.3')
  })

  it('均值 ≥ 技术要求 → 自动判 合格', () => {
    render(<RebarWeldingTensileCard {...makeProps()} />)
    fireEvent.change(screen.getAllByLabelText('技术要求', { selector: 'select' })[0]!, {
      target: { value: REQ.id },
    })
    const loadInputs = screen.getAllByLabelText(/最大荷重/)
    // d=22, F=270 → Rm≈710 MPa；技术要求 ≥540 → 合格
    fireEvent.change(loadInputs[0]!, { target: { value: '270' } })
    fireEvent.change(loadInputs[1]!, { target: { value: '270' } })
    fireEvent.change(loadInputs[2]!, { target: { value: '270' } })
    expect(screen.getAllByText('合格').length).toBeGreaterThan(0)
  })

  it('readOnly → onChange 不被调用（输入吞掉）', () => {
    const onChange = vi.fn()
    render(<RebarWeldingTensileCard {...makeProps({ readOnly: true, onChange })} />)
    fireEvent.change(screen.getAllByLabelText(/最大荷重/)[0]!, { target: { value: '270' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('RebarWeldingBendCard UI（1 样品 = 3 试件，扁平）', () => {
  beforeEach(() => cleanup())
  it('空 record → 3 行（每行 1 角度 + 1 结果，无「试件 #N」分组）', () => {
    render(<RebarWeldingBendCard {...makeProps({ parameter: BEND_PARAM })} />)
    expect(screen.getAllByLabelText(/弯曲角度/)).toHaveLength(TRIAL_COUNT)
    expect(screen.getAllByLabelText(/弯曲结果/)).toHaveLength(TRIAL_COUNT)
  })

  it('3 件全合格 → 整体 合格', () => {
    render(<RebarWeldingBendCard {...makeProps({ parameter: BEND_PARAM })} />)
    expect(screen.getAllByText('合格').length).toBeGreaterThan(0)
  })

  it('任一件不合格 → 整体 不合格', () => {
    render(<RebarWeldingBendCard {...makeProps({ parameter: BEND_PARAM })} />)
    const selects = screen.getAllByLabelText(/弯曲结果/) as HTMLSelectElement[]
    fireEvent.change(selects[1]!, { target: { value: '不合格' } })
    expect(screen.getAllByText('不合格').length).toBeGreaterThan(0)
  })
})