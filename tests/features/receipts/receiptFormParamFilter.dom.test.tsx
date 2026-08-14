import { describe, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installShapeAdapters, seedData } from '../../helpers/seed'
import { server } from '../../setup.dom'
import { useAuthStore } from '@/state/authStore'
import { ReceiptFormModal } from '@/features/receipts/ReceiptFormModal'
import { fnTest } from '../../fn'

/**
 * 新建接样单：检测参数按选中的检测报告过滤。
 * 选水泥报告(RN-101) → 只列该报告关联的参数（如「细度（比表面积）」），
 * 不再把全库参数（如骨料类「颗粒级配」IP-0170）一并列出。
 */

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

function renderModal() {
  return render(
    <ReceiptFormModal
      open
      mode="create"
      contracts={[]}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
}

describe('ReceiptFormModal 检测参数按报告过滤', () => {
  beforeEach(() => {
    installShapeAdapters(server) // 报告名称/参数/标准 {items} 形状 + 链接过滤
    seedData() // no-op：lab-msw seeds 已含报告名称 + 报告↔参数关联 + 参数/标准主表
    loginAsAdmin()
  })

  fnTest(['M03.F01.I02'], '选水泥报告 → 检测参数收窄到该报告关联参数（骨料参数不再出现）', async () => {
    renderModal()
    const user = userEvent.setup()

    // 选中水泥报告 → 参数收窄到 RN-101 关联的 17 项。
    const cementOption = await screen.findByRole('option', { name: '水泥' })
    const reportSelect = cementOption.closest('select') as HTMLSelectElement
    await user.selectOptions(reportSelect, 'RN-101')

    // 水泥关联参数出现（含高位编码 IP-0548「细度（比表面积）」，带单位后缀）。
    await waitFor(() => {
      expect(screen.getByText(/细度（比表面积）/)).toBeInTheDocument()
    })
    // 骨料类「颗粒级配」(IP-0170，不属水泥报告) 不出现 → 证明按报告过滤生效。
    expect(screen.queryByText('颗粒级配')).not.toBeInTheDocument()
  })
})
