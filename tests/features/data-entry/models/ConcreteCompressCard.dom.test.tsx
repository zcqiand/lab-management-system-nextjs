import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConcreteCompressCard, computeConcreteCompress } from '@/features/data-entry/models/ConcreteCompressCard'
import type { ParamModelProps } from '@/features/data-entry/models/types'

function baseProps(overrides: Partial<ParamModelProps> = {}): ParamModelProps {
  return {
    parameter: { code: 'IP-0055', name: '抗压强度', unit: 'MPa' } as ParamModelProps['parameter'],
    record: undefined,
    sampleId: 's-test',
    standards: [],
    stdParams: [],
    techReqs: [],
    config: { specimenCount: 3, area: 22500 },
    onChange: vi.fn(),
    ...overrides,
  }
}

describe('computeConcreteCompress', () => {
  it('荷载→强度 + 代表值=均值，保留2位', () => {
    const r = computeConcreteCompress([120.0, 135.0, 150.0], 22500)
    // 120*1000/22500=5.33 ; 135→6.00 ; 150→6.67 ; 均值=6.00
    expect(r.strengths).toEqual([5.33, 6.0, 6.67])
    expect(r.representative).toBe(6.0)
  })
  it('空输入返回空 strengths + representative=undefined', () => {
    const r = computeConcreteCompress([], 22500)
    expect(r.strengths).toEqual([])
    expect(r.representative).toBeUndefined()
  })
})

describe('ConcreteCompressCard', () => {
  beforeEach(() => {
    cleanup()
  })

  it('按 specimenCount 渲染 3 个荷载输入，无技术要求/单项评定', () => {
    render(<ConcreteCompressCard {...baseProps()} />)
    expect(screen.getAllByPlaceholderText(/破坏荷载/).length).toBe(3)
    expect(screen.queryByText('技术要求')).toBeNull()
    expect(screen.queryByText('单项评定')).toBeNull()
  })

  it('表头与行号用 # / 1 / 2 / 3（不再用「试件」前缀）', () => {
    render(<ConcreteCompressCard {...baseProps()} />)
    // 表头：单格「#」
    expect(screen.getByText('#')).toBeTruthy()
    // 行号：纯数字 1/2/3
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    // 反向断言：不再出现「试件」前缀
    expect(screen.queryByText('试件')).toBeNull()
    expect(screen.queryByText(/^试件\d+$/)).toBeNull()
  })

  it('录入 3 荷载后显示 3 强度 + 代表值，onChange 上报 result JSON', async () => {
    const onChange = vi.fn()
    render(<ConcreteCompressCard {...baseProps({ onChange })} />)
    const user = userEvent.setup()
    const inputs = screen.getAllByPlaceholderText(/破坏荷载/)
    await user.type(inputs[0]!, '120')
    await user.type(inputs[1]!, '135')
    await user.type(inputs[2]!, '150')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.stringContaining('"representative":6'),
      }),
    )
    // 代表值=均值=6；整数值正常渲染为 "6"（非 "6.0"/"6.00"）。匹配「代表值：6」行尾。
    expect(screen.getByText(/代表值：6\b/)).toBeTruthy()
  })

  it('进入时从 record.result(JSON) 反解析回填', () => {
    const record = {
      result: JSON.stringify({ loads: [120, 135, 150], strengths: [5.33, 6.0, 6.67], representative: 6.0 }),
    } as ParamModelProps['record']
    render(<ConcreteCompressCard {...baseProps({ record })} />)
    const inputs = screen.getAllByPlaceholderText(/破坏荷载/) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('120')
    expect(inputs[2]!.value).toBe('150')
  })
})
