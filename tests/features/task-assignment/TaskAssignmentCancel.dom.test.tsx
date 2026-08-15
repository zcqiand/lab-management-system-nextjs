import { describe, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'
import { installShapeAdapters } from '../../helpers/seed'
import { TaskAssignmentPage } from '@/features/task-assignment/TaskAssignmentPage'

// FlowStagePage 用 next/navigation 的 useRouter（查看详情跳转）——
// jsdom 无 AppRouter context，mock 掉（本测试不点查看详情，只保 render 不炸）。
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const ASSIGNED_RECEIPT = {
  id: 'r-assigned',
  commissionCode: 'C-ASSIGNED-001',
  commissionDate: '2026-07-01',
  categoryCode: 'steel',
  contractId: 'c1',
  reportCode: 'R-001',
  testCategory: '钢筋',
  receivedBy: '张三',
  assigneeId: 'u-zhangsan',
  assigneeName: '张三',
  plannedTestDate: '2026-07-15',
  result: 'pass' as const,
  flowStatus: 'task_assignment' as const,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  cleanup()
  // 形状适配层（report-names 等 {items} 包装）；GET /receipts 再由 server.use 覆盖
  installShapeAdapters(server)
  server.use(
    http.get('*/api/receipts', () =>
      HttpResponse.json({ items: [ASSIGNED_RECEIPT], total: 1 }),
    ),
  )
})

describe('TaskAssignmentPage 任务取消（M03.F02.I03）', () => {
  // 锚点存在性验证：页面容器（I01）+ 安排按钮（I02）+ 三态过滤器（I04）
  fnTest(['M03.F02.I01', 'M03.F02.I02', 'M03.F02.I04'], '任务安排页 4 锚点存在', async () => {
    const { container } = render(
      <TaskAssignmentPage />,
    )
    await waitFor(() =>
      expect(screen.getAllByText('C-ASSIGNED-001').length).toBeGreaterThan(0),
    )
    // I01 页面容器
    expect(container.querySelector('[data-fn="M03.F02.I01"]')).not.toBeNull()
    // I02 安排按钮
    expect(container.querySelector('[data-fn="M03.F02.I02"]')).not.toBeNull()
    // I04 三态过滤器
    expect(container.querySelector('[data-fn="M03.F02.I04"]')).not.toBeNull()
  })

  fnTest(['M03.F02.I03'], '已安排的接样单显示「取消任务」按钮 + 点击触发 PUT 清空 assignee', async () => {
    let putCalled = false
    server.use(
      http.put('*/api/receipts/r-assigned', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        putCalled = true
        // 验证请求体清空 assignee
        expect(body.assigneeName).toBe('')
        return HttpResponse.json({ ...ASSIGNED_RECEIPT, ...body })
      }),
    )
    const { container } = render(
      <TaskAssignmentPage />,
    )
    await waitFor(() =>
      expect(screen.getAllByText('C-ASSIGNED-001').length).toBeGreaterThan(0),
    )
    // 「取消任务」按钮挂 data-fn="M03.F02.I03"
    expect(container.querySelector('[data-fn="M03.F02.I03"]')).not.toBeNull()
    // 「安排」按钮也挂 I02（已存在测试，但这里一起断言）
    expect(container.querySelector('[data-fn="M03.F02.I02"]')).not.toBeNull()
    // 点击「取消任务」触发 PUT
    const cancelBtn = container.querySelector('[data-fn="M03.F02.I03"]') as HTMLButtonElement
    cancelBtn.click()
    await waitFor(() => expect(putCalled).toBe(true))
  })
})
