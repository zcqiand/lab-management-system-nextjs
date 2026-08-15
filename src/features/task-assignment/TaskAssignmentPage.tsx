import { useCallback, useState } from 'react'
import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'
import { ConfirmModal } from '@/components/ConfirmModal'
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import type { SampleReceipt } from '@/types/api'

/** 任务安排——流程线第二环节（flowStatus='task_assignment'）。
 * 为接样单指定检测人员与计划检测日期；提交（支持批量）后进入「数据录入」；
 * 可退回「接样」；已提交的可由提交人撤回。
 * 任务信息直接记录在接样单（assigneeId/assigneeName/plannedTestDate），无独立任务表。
 */
function AssignButton({ receipt, onAssign, refresh }: { receipt: SampleReceipt; onAssign: (r: SampleReceipt, refresh: () => Promise<void>) => void; refresh: () => Promise<void> }) {
  return (
    <button onClick={() => onAssign(receipt, refresh)} data-fn="M03.F02.I02" className="px-2 py-1 text-purple-600 hover:underline">
      安排
    </button>
  )
}

/** 任务取消——M03.F02.I03：清空 assigneeName/assigneeId/plannedTestDate，回到未分配态 */
function CancelButton({ receipt, onCancel, refresh }: { receipt: SampleReceipt; onCancel: (r: SampleReceipt, refresh: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  return (
    <button
      // @entry M03.F02.I03 任务取消（已安排的接样单「取消任务」按钮，清空 assignee + plannedTestDate）
      onClick={() => onCancel(receipt, refresh)}
      data-fn="M03.F02.I03"
      className="px-2 py-1 text-red-600 hover:underline"
    >
      取消任务
    </button>
  )
}

export function TaskAssignmentPage() {
  const [target, setTarget] = useState<SampleReceipt | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [plannedTestDate, setPlannedTestDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshAfterSave, setRefreshAfterSave] = useState<(() => Promise<void>) | null>(null)

  const openAssign = (r: SampleReceipt, refresh: () => Promise<void>) => {
    setTarget(r)
    setAssigneeName(r.assigneeName ?? '')
    setPlannedTestDate(r.plannedTestDate ?? new Date().toISOString().split('T')[0] ?? '')
    setRefreshAfterSave(() => refresh)
  }

  const cancelAssignment = async (r: SampleReceipt, refresh: () => Promise<void>) => {
    await apiClient.put(`${API_ROUTES['/receipts']}/${r.id}`, {
      assigneeName: '',
      assigneeId: undefined,
      plannedTestDate: undefined,
    })
    await refresh()
  }

  const rowAction = useCallback((r: SampleReceipt, refresh: () => Promise<void>) => (
    <>
      <AssignButton receipt={r} onAssign={openAssign} refresh={refresh} />
      {r.assigneeName && <CancelButton receipt={r} onCancel={cancelAssignment} refresh={refresh} />}
    </>
  ), [])

  const handleSave = async () => {
    if (!target) return
    setSaving(true)
    try {
      await apiClient.put(`${API_ROUTES['/receipts']}/${target.id}`, {
        assigneeName: assigneeName.trim(),
        assigneeId: assigneeName.trim() ? `u-${assigneeName.trim()}` : undefined,
        plannedTestDate,
      })
      setTarget(null)
      await refreshAfterSave?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    // @entry M03.F02.I01
    // @entry M03.F02.I04
    <>
      <FlowStagePage
        title="任务安排"
        stage="task_assignment"
        subtitle="指定检测人员后提交进入数据录入"
        dataFn="M03.F02.I01"
        filterDataFn="M03.F02.I04"
        extraColumns={[
          {
            header: '检测人员',
            render: (r) => r.assigneeName ?? <span className="text-gray-400">待安排</span>,
          },
          {
            header: '计划检测日期',
            render: (r) => r.plannedTestDate ?? <span className="text-gray-400">—</span>,
          },
        ]}
        rowActions={rowAction}
      />

      <ConfirmModal
        open={target !== null}
        title={`任务安排 — ${target?.commissionCode ?? ''}`}
        danger={false}
        message={
          <div className="space-y-3 text-left text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">检测人员</label>
              <input
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="如：张三"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">计划检测日期</label>
              <input
                type="date"
                value={plannedTestDate}
                onChange={(e) => setPlannedTestDate(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        }
        confirmText="保存"
        loading={saving}
        onConfirm={handleSave}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}

export default TaskAssignmentPage
