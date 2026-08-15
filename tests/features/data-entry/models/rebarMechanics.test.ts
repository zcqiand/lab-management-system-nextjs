import { describe, it, expect } from 'vitest'
import {
  strengthFromLoad,
  computeStrengths,
  ratioTensileOverYield,
  ratioMeasuredOverSpec,
  meanOf,
  round1,
  round2,
  parseRebarMechResult,
  strengthsFromRecordResult,
} from '@/features/data-entry/models/rebar-mechanics'

describe('rebarMechanics 强度计算', () => {
  it('strengthFromLoad = 4000·F/(π·d²)，圆整 0.1', () => {
    // 4000*100/(π*20²) = 400000/1256.637 = 318.31 → 318.3
    expect(strengthFromLoad(100, 20)).toBe(318.3)
  })
  it('载荷或直径 ≤0 → 0', () => {
    expect(strengthFromLoad(0, 20)).toBe(0)
    expect(strengthFromLoad(100, 0)).toBe(0)
  })
  it('computeStrengths 逐组计算，缺项为 0', () => {
    expect(computeStrengths([100, 0], 20)).toEqual([318.3, 0])
  })
})

describe('rebarMechanics 比值计算', () => {
  it('强屈比[i] = 抗拉[i]/屈服[i]，圆整 0.01', () => {
    expect(ratioTensileOverYield([550, 560], [430, 440], 2)).toEqual([round2(550 / 430), round2(560 / 440)])
    expect(ratioTensileOverYield([550, 560], [430, 440], 2)).toEqual([1.28, 1.27])
  })
  it('任一无效 → 该组 0', () => {
    expect(ratioTensileOverYield([550, 0], [430, 440], 2)).toEqual([1.28, 0])
  })
  it('超强比[i] = 实测屈服[i]/标准屈服值', () => {
    expect(ratioMeasuredOverSpec([430, 440], 400, 2)).toEqual([1.08, 1.1])
  })
  it('无标准值 → 全 0', () => {
    expect(ratioMeasuredOverSpec([430, 440], undefined, 2)).toEqual([0, 0])
  })
})

describe('rebarMechanics 均值与解析', () => {
  it('meanOf 忽略 0/无效', () => {
    expect(meanOf([318.3, 0], round1)).toBe(318.3)
    expect(meanOf([1.28, 1.26], round2)).toBe(1.27)
  })
  it('无有效值 → undefined', () => {
    expect(meanOf([], round1)).toBeUndefined()
    expect(meanOf([0, 0], round1)).toBeUndefined()
  })
  it('parseRebarMechResult 往返，定长补零', () => {
    const raw = JSON.stringify({ diameter: 22, loads: [100], strengths: [318.3], mean: 318.3 })
    const parsed = parseRebarMechResult(raw, 2)
    expect(parsed.diameter).toBe(22)
    expect(parsed.loads).toEqual([100, 0])
    expect(parsed.strengths).toEqual([318.3, 0])
    expect(parsed.mean).toBe(318.3)
  })
  it('解析失败/空 → 定长空结果', () => {
    expect(parseRebarMechResult(undefined, 2).strengths).toEqual([0, 0])
    expect(parseRebarMechResult('not-json', 2).loads).toEqual([0, 0])
  })
  it('strengthsFromRecordResult 抽取 strengths 数组', () => {
    expect(strengthsFromRecordResult(JSON.stringify({ strengths: [550, 560] }))).toEqual([550, 560])
    expect(strengthsFromRecordResult(undefined)).toEqual([])
  })
})
