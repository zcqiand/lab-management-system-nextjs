import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DefaultParamCard } from '@/features/data-entry/models/DefaultParamCard'
import type { ParamModelProps } from '@/features/data-entry/models/types'
import type { TestRecord } from '@/types/process/test-record'

function baseProps(overrides: Partial<ParamModelProps> = {}): ParamModelProps {
  return {
    parameter: { code: 'IP-0001', name: '含水率', canonicalName: '含水率', unit: '%' } as ParamModelProps['parameter'],
    record: undefined,
    sampleId: 's-test',
    standards: [{ code: 'GB/T 1', name: '示例标准' } as ParamModelProps['standards'][number]],
    stdParams: [{ inspectionParameterCode: 'IP-0001', inspectionStandardCode: 'GB/T 1' } as ParamModelProps['stdParams'][number]],
    techReqs: [],
    config: undefined,
    onChange: vi.fn(),
    ...overrides,
  }
}

describe('DefaultParamCard', () => {
  beforeEach(() => {
    cleanup()
  })

  it('渲染四格：检测依据/技术要求/检测结果/单项评定', () => {
    render(<DefaultParamCard {...baseProps()} />)
    expect(screen.getByText('检测依据')).toBeTruthy()
    expect(screen.getByText('技术要求')).toBeTruthy()
    expect(screen.getByText('检测结果')).toBeTruthy()
    expect(screen.getByText('单项评定')).toBeTruthy()
  })

  it('录入检测结果时 onChange 上报 {result}', async () => {
    // 组件是受控抬升模式（value 来自 record.result，改动通过 onChange 上报由父组件合并）。
    // 用 stateful wrapper 模拟真实父组件把 patch 回灌进 record，否则每次按键 input 都被重置为空。
    const onChange = vi.fn()
    function Harness() {
      const [rec, setRec] = useState<TestRecord | undefined>(undefined)
      const props = baseProps({
        record: rec,
        onChange: (patch) => {
          onChange(patch)
          setRec((prev) => ({ ...(prev ?? ({} as TestRecord)), ...patch }) as TestRecord)
        },
      })
      return <DefaultParamCard {...props} />
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('录入检测结果'), '12.3')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ result: expect.stringContaining('12.3') }))
  })

  it('单项评定选「合格」时 onChange 上报 {verdict:"合格"}', async () => {
    const onChange = vi.fn()
    render(<DefaultParamCard {...baseProps({ onChange })} />)
    const user = userEvent.setup()
    const select = screen.getByDisplayValue('未评定')
    await user.selectOptions(select, '合格')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ verdict: '合格' }))
  })
})
