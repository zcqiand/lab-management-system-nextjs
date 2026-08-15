import { describe, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'
import { installShapeAdapters } from '../../helpers/seed'
import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'

// 验证 4 个 Report 页面（ReportReview/Approve/Issue/Archive）共用的 FlowStagePage
// 在不同 stage 下行级「查看详情」按钮（Mxx.I02）和行级「提交」按钮（Mxx.I03）
// 都正确挂上 data-fn 锚点 —— 每个 stage 一个 case，挂 2 个 fn。

// FlowStagePage 用 next/navigation 的 useRouter（查看详情跳 /receipts/:id）——
// jsdom 无 AppRouter context，mock 掉（本测试不点查看详情，只保 render 不炸）。
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const MOCK_RECEIPT = {
  id: 'r-test-datafn',
  commissionCode: 'C-2026-TEST',
  commissionDate: '2026-07-01',
  categoryCode: 'steel',
  contractId: 'c1',
  reportCode: 'R-2026-TEST',
  testCategory: '钢筋',
  receivedBy: '张三',
  result: 'pass' as const,
  flowStatus: 'review' as const,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  cleanup()
  installShapeAdapters(server)
})

/**
 * 给某个 stage 注入一个 flowStatus 对齐的 mock receipt
 * （覆盖外层 seed，确保 rows.map 至少渲染 1 行 → 行级按钮带 data-fn 渲染）
 */
function mockReceiptAt(stage: 'receiving' | 'task_assignment' | 'data_entry' | 'review' | 'approval' | 'issuance' | 'archived') {
  server.use(
    http.get('*/api/receipts', () =>
      HttpResponse.json({ items: [{ ...MOCK_RECEIPT, flowStatus: stage }], total: 1 }),
    ),
  )
}

describe('FlowStagePage 行级按钮 data-fn 锚点（4 个 Report 页面共用）', () => {
  // 用 querySelectorAll 查 I02/I03 data-fn 锚点元素 —— 长度 ≥ 1 即 props 传入成功。
  // （列表非空 + viewDataFn/actionDataFn 传到位 → 按钮渲染并带正确 data-fn）

  fnTest(['M03.F05.I01', 'M03.F05.I02', 'M03.F05.I03', 'M03.F05.I04'], '审核页：查看详情 + 审核通过 按钮挂 data-fn', async () => {
    mockReceiptAt('review')
    const { container } = render(
      <FlowStagePage
        title="报告审核"
        stage="review"
        submitLabel="审核通过"
        dataFn="M03.F05.I01"
        filterDataFn="M03.F05.I04"
        viewDataFn="M03.F05.I02"
        actionDataFn="M03.F05.I03"
      />,
    )
    // 列表 fetch 是异步的：waitFor 阶段 1 等 I04 filter select 渲染，
    // 阶段 2 等 row 内 action 列按钮挂上 I02/I03 data-fn（CI 异步时序比本机慢一拍，
    // 同步 expect 容易抓到 useEffect 之 setList 还没回的瞬间）
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F05.I04"]')).not.toBeNull()
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-fn="M03.F05.I02"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('[data-fn="M03.F05.I03"]').length).toBeGreaterThan(0)
    })
  })

  fnTest(['M03.F06.I01', 'M03.F06.I02', 'M03.F06.I03', 'M03.F06.I04'], '批准页：查看详情 + 批准 按钮挂 data-fn', async () => {
    mockReceiptAt('approval')
    const { container } = render(
      <FlowStagePage
        title="报告批准"
        stage="approval"
        submitLabel="批准"
        dataFn="M03.F06.I01"
        filterDataFn="M03.F06.I04"
        viewDataFn="M03.F06.I02"
        actionDataFn="M03.F06.I03"
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F06.I04"]')).not.toBeNull()
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-fn="M03.F06.I02"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('[data-fn="M03.F06.I03"]').length).toBeGreaterThan(0)
    })
  })

  fnTest(['M03.F07.I01', 'M03.F07.I02', 'M03.F07.I03', 'M03.F07.I04'], '发放页：查看详情 + 发放 按钮挂 data-fn', async () => {
    mockReceiptAt('issuance')
    const { container } = render(
      <FlowStagePage
        title="报告发放"
        stage="issuance"
        submitLabel="发放"
        dataFn="M03.F07.I01"
        filterDataFn="M03.F07.I04"
        viewDataFn="M03.F07.I02"
        actionDataFn="M03.F07.I03"
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F07.I04"]')).not.toBeNull()
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-fn="M03.F07.I02"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('[data-fn="M03.F07.I03"]').length).toBeGreaterThan(0)
    })
  })

  fnTest(['M03.F08.I01', 'M03.F08.I02', 'M03.F08.I03', 'M03.F08.I04'], '归档页：查看详情 + 归档 按钮挂 data-fn', async () => {
    mockReceiptAt('archived')
    const { container } = render(
      <FlowStagePage
        title="报告归档"
        stage="archived"
        submitLabel="归档"
        dataFn="M03.F08.I01"
        filterDataFn="M03.F08.I04"
        viewDataFn="M03.F08.I02"
        actionDataFn="M03.F08.I03"
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F08.I04"]')).not.toBeNull()
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-fn="M03.F08.I02"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('[data-fn="M03.F08.I03"]').length).toBeGreaterThan(0)
    })
  })

  // 接样管理（ReceiptList）与数据录入（DataEntryPage）复用 FlowStagePage 的三态过滤器，
  // filterDataFn 分别挂 M03.F01.I06 / M03.F03.I07。这里直接以对应 stage 渲染 FlowStagePage
  // 验证过滤器锚点挂上（与上面 4 个 Report 页同构，仅 stage/filterDataFn 不同）。
  fnTest(['M03.F01.I06'], '接样页：三态过滤器挂 data-fn', async () => {
    mockReceiptAt('receiving')
    const { container } = render(
      <FlowStagePage
        title="接样管理"
        stage="receiving"
        submitLabel="提交"
        dataFn="M03.F01.I01"
        filterDataFn="M03.F01.I06"
        viewDataFn="M03.F09.I01"
        actionDataFn="M03.F01.I02"
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F01.I06"]')).not.toBeNull()
    })
  })

  fnTest(['M03.F03.I07'], '数据录入页：三态过滤器挂 data-fn', async () => {
    mockReceiptAt('data_entry')
    const { container } = render(
      <FlowStagePage
        title="数据录入"
        stage="data_entry"
        submitLabel="提交"
        dataFn="M03.F03.I01"
        filterDataFn="M03.F03.I07"
        viewDataFn="M03.F09.I01"
        actionDataFn="M03.F03.I02"
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-fn="M03.F03.I07"]')).not.toBeNull()
    })
  })
})
