import { describe, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'
import { installShapeAdapters, seedData, resetFixtures } from '../../helpers/seed'
import { useAuthStore } from '@/state/authStore'
import { ReportReviewPage } from '@/features/reports/ReportReviewPage'
import { ReportApprovePage } from '@/features/reports/ReportApprovePage'
import { ReportIssuePage } from '@/features/reports/ReportIssuePage'
import { ReportArchivePage } from '@/features/reports/ReportArchivePage'

/**
 * Task 11：reports 4 阶段页（M03.F05-F08）smoke + flow 动作穿透。
 *
 * - 4 页壳：各渲染标题不炸（参数化 FlowStagePage，stage/label 不同）
 * - flow 动作：submit（审核通过 review→approval）穿透 —— 依赖 seed.ts
 *   installShapeAdapters 的 POST /api/receipts/flow 适配（{results} 形状 +
 *   完整流转语义，lab-msw 裸数组 + withdraw no-op 的债在适配层补齐）。
 */

// FlowStagePage 用 next/navigation 的 useRouter（查看详情跳 /receipts/:id）——
// jsdom 无 AppRouter context，mock 掉（本测试不点查看详情，只保 render 不炸）。
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function loginAsAdmin() {
  useAuthStore.setState({
    user: {
      id: 'u-admin',
      username: 'labadmin',
      displayName: '实验室管理员',
      role: { id: 'role-admin', name: 'admin', permissions: [] },
      permissions: ['report:read', 'report:write'],
    },
    token: 'test-token',
  })
}

beforeEach(() => {
  cleanup()
  loginAsAdmin()
  resetFixtures()
  seedData()
  installShapeAdapters(server)
})

describe('reports 4 阶段页（M03.F05-F08）', () => {
  fnTest(['M03.F05.I01'], '审核页壳 smoke：渲染标题「报告审核」不炸', async () => {
    render(<ReportReviewPage />)
    expect(screen.getByText('报告审核')).toBeTruthy()
    // 副标题来自 props（FlowStagePage 标题栏下方说明行）
    await waitFor(() => {
      expect(screen.getByText(/审核通过后进入报告批准/)).toBeTruthy()
    })
  })

  fnTest(['M03.F06.I01'], '批准页壳 smoke：渲染标题「报告批准」不炸', async () => {
    render(<ReportApprovePage />)
    expect(screen.getByText('报告批准')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/批准后进入报告发放/)).toBeTruthy()
    })
  })

  fnTest(['M03.F07.I01'], '发放页壳 smoke：渲染标题「报告发放」不炸', async () => {
    render(<ReportIssuePage />)
    expect(screen.getByText('报告发放')).toBeTruthy()
    // seedData 有 issuance 单据（如 RC-2024-0502-01），等待列表行渲染
    await waitFor(() => {
      expect(screen.getByText('RC-2024-0502-01')).toBeTruthy()
    })
  })

  fnTest(['M03.F08.I01'], '归档页壳 smoke：渲染标题「报告归档」不炸', async () => {
    render(<ReportArchivePage />)
    expect(screen.getByText('报告归档')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/归档后流程结束/)).toBeTruthy()
    })
  })

  // flow 动作穿透：审核页对 review 单据点行级「审核通过」→ submit 状态流转
  // review → approval。单据离开 review 主列表，同时出现在「我提交的（可撤回）」
  // 区块（flowStatus=approval + lastSubmittedBy=本人）。
  fnTest(['M03.F05.I03'], '审核通过动作穿透：review 单据 submit 后流入批准环节', async () => {
    render(<ReportReviewPage />)
    // seedData：rc-002-01（RC-2024-0510-01）在 review 环节
    const code = 'RC-2024-0510-01'
    await waitFor(() => {
      expect(screen.getByText(code)).toBeTruthy()
    })
    const row = screen.getByText(code).closest('tr')!
    const approveBtn = row.querySelector('[data-fn="M03.F05.I03"]') as HTMLButtonElement
    expect(approveBtn).not.toBeNull()
    expect(approveBtn.textContent).toContain('审核通过')
    await userEvent.click(approveBtn)
    // runFlow 成功后 notice「已提交 1 条」
    await waitFor(() => {
      expect(screen.getByText('已提交 1 条')).toBeTruthy()
    })
    // 刷新后：该单据仍在页面上，但已挪进「我提交的（可撤回）」区块（行带撤回按钮）
    await waitFor(() => {
      const after = screen.getByText(code).closest('tr')!
      expect(after.textContent).toContain('撤回')
      expect(after.textContent).toContain('批准中')
    })
  })

  // submit → review 双动作穿透：data_entry 单据先提交入 review，再审核通过入 approval。
  // 用数据录入 stage 的 FlowStagePage 参数化形态（同组件，不同 stage）验证
  // flow POST 适配的多阶段连续流转（同一 fixtures 数组原地流转，数据同源）。
  fnTest(['M03.F05.I03'], 'flow 适配多阶段连续流转：data_entry → review → approval', async () => {
    const { FlowStagePage } = await import('@/features/flow-pipeline/FlowStagePage')
    // seedData：rc-003-02（RC-2024-0526-01）在 data_entry 环节
    const code = 'RC-2024-0526-01'
    // 第一跳：数据录入页（M03.F03 形态）提交 → data_entry → review
    const { unmount } = render(
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
      expect(screen.getByText(code)).toBeTruthy()
    })
    const entryRow = screen.getByText(code).closest('tr')!
    const submitBtn = entryRow.querySelector('[data-fn="M03.F03.I02"]') as HTMLButtonElement
    await userEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('已提交 1 条')).toBeTruthy()
    })
    unmount()
    cleanup()

    // 第二跳：审核页（M03.F05 形态）对同一单据点「审核通过」→ approval
    render(<ReportReviewPage />)
    await waitFor(() => {
      expect(screen.getByText(code)).toBeTruthy()
    })
    const reviewRow = screen.getByText(code).closest('tr')!
    const approveBtn = reviewRow.querySelector('[data-fn="M03.F05.I03"]') as HTMLButtonElement
    await userEvent.click(approveBtn)
    await waitFor(() => {
      expect(screen.getByText('已提交 1 条')).toBeTruthy()
    })
    // 终态：单据进入「我提交的（可撤回）」区块（approval + 本人提交），状态=批准中
    await waitFor(() => {
      const after = screen.getByText(code).closest('tr')!
      expect(after.textContent).toContain('撤回')
      expect(after.textContent).toContain('批准中')
    })
  })
})
