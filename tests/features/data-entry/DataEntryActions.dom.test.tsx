import { describe, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'
import { EntryModal } from '@/features/data-entry/DataEntryPage'

const MOCK_RECEIPT = {
  id: 'r-test',
  commissionCode: 'C-2026-001',
  commissionDate: '2026-07-01',
  categoryCode: 'steel',
  contractId: 'c1',
  reportCode: 'R-001',
  testCategory: '钢筋',
  receivedBy: '张三',
  result: 'pass' as const,
  flowStatus: 'data_entry' as const,
  sampleSource: 'client',
  flowHistory: [],
  lastSubmittedBy: '',
  createdAt: '',
  updatedAt: '',
}

const MOCK_SAMPLE = {
  id: 's1',
  receiptId: 'r-test',
  sampleCode: 'S-001',
  sampleName: '钢筋样品',
  brand: 'HRB400',
  model: 'Φ22',
  spec: 'Φ22',
  grade: '一级',
  testCategory: '钢筋',
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  cleanup()
  server.use(
    http.get('*/api/samples*', () =>
      HttpResponse.json({ items: [MOCK_SAMPLE], total: 1 }),
    ),
    http.get('*/api/test-records*', () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
    http.get('*/api/param-interfaces/links*', () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get('*/api/calculation-rules*', () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get('*/api/inspection/objects*', () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
    http.get('*/api/inspection/standards*', () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get('*/api/technical-requirements*', () =>
      HttpResponse.json({ items: [] }),
    ),
  )
})

describe('EntryModal 数据录入 3 锚点（M03.F03.I02/I04/I06）', () => {
  fnTest(['M03.F03.I02'], 'footer「保存」按钮挂 M03.F03.I02 + 点击触发 PUT', async () => {
    let putCalled = false
    server.use(
      http.put('*/api/receipts/r-test', async () => {
        putCalled = true
        return HttpResponse.json(MOCK_RECEIPT)
      }),
    )
    const { container } = render(
        <EntryModal receipt={MOCK_RECEIPT} onClose={() => {}} />
    )
    await waitFor(() =>
      expect(screen.getAllByText('S-001').length).toBeGreaterThan(0),
    )
    expect(container.querySelector('[data-fn="M03.F03.I02"]')).not.toBeNull()
    const saveBtn = container.querySelector('[data-fn="M03.F03.I02"]') as HTMLButtonElement
    fireEvent.click(saveBtn)
    await waitFor(() => expect(putCalled).toBe(true))
  })

  fnTest(['M03.F03.I04'], '侧栏样品卡右上角「×」按钮挂 M03.F03.I04 + 点击弹 ConfirmModal', async () => {
    const { container } = render(
        <EntryModal receipt={MOCK_RECEIPT} onClose={() => {}} />
    )
    await waitFor(() =>
      expect(screen.getAllByText('S-001').length).toBeGreaterThan(0),
    )
    expect(container.querySelector('[data-fn="M03.F03.I04"]')).not.toBeNull()
    const delBtn = container.querySelector('[data-fn="M03.F03.I04"]') as HTMLButtonElement
    fireEvent.click(delBtn)
    // ConfirmModal 弹出，含「删除」确认按钮
    await waitFor(() =>
      expect(screen.getByText(/删除样品 —/)).toBeInTheDocument(),
    )
  })

  fnTest(['M03.F03.I06'], 'footer「改判」select 挂 M03.F03.I06 + 选 pass 后应用', async () => {
    let putCalled = false
    server.use(
      http.put('*/api/receipts/r-test', async ({ request }) => {
        const body = (await request.json()) as { result?: string }
        if (body.result === 'fail') putCalled = true
        return HttpResponse.json(MOCK_RECEIPT)
      }),
    )
    const { container } = render(
        <EntryModal receipt={MOCK_RECEIPT} onClose={() => {}} />
    )
    await waitFor(() =>
      expect(screen.getAllByText('S-001').length).toBeGreaterThan(0),
    )
    expect(container.querySelector('[data-fn="M03.F03.I06"]')).not.toBeNull()
    const sel = container.querySelector('[data-fn="M03.F03.I06"]') as HTMLSelectElement
    fireEvent.change(sel, { target: { value: 'fail' } })
    // 应用按钮在 select 之后
    const applyBtn = screen.getByText('应用改判')
    fireEvent.click(applyBtn)
    await waitFor(() => expect(putCalled).toBe(true))
  })
})