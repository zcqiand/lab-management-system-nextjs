import { useCallback, useEffect, useRef, useState } from 'react'
import { useContractStore } from '@/state/contractStore'
import { ReceiptFormModal, type ReceiptFormValues } from './ReceiptFormModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import type { SampleReceipt } from '@/types/api'

/** 接样管理——流程线第一环节（flowStatus='receiving'）。
 * 显示接样中的接样单，可新建/编辑/删除；提交后进入任务安排。已提交的单不可编辑/删除。 */
function ReceiptRowActions({
  receipt,
  onEdit,
  onDelete,
}: {
  receipt: SampleReceipt
  onEdit: (r: SampleReceipt) => void
  onDelete: (r: SampleReceipt) => void
}) {
  return (
    <>
      <button onClick={() => onEdit(receipt)} data-fn="M03.F01.I03" className="px-2 py-1 text-blue-600 hover:underline">编辑</button>
      <button onClick={() => onDelete(receipt)} data-fn="M03.F01.I04" className="px-2 py-1 text-red-600 hover:underline">删除</button>
    </>
  )
}

export function ReceiptList() {
  const { list: contracts, fetchContracts } = useContractStore()
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<SampleReceipt | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SampleReceipt | null>(null)
  const [deleting, setDeleting] = useState(false)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (contracts.length === 0) {
      fetchContracts({ page: 1, pageSize: 100 })
    }
  }, [contracts.length, fetchContracts])

  const handleSubmit = async (values: ReceiptFormValues) => {
    setSubmitting(true)
    try {
      const payload = {
        contractId: values.contractId,
        categoryCode: values.categoryCode,
        commissionCode: values.commissionCode,
        commissionDate: values.commissionDate,
        projectName: values.projectName,
        clientUnit: values.clientUnit,
        buildingUnit: values.buildingUnit,
        supervisorUnit: values.supervisorUnit,
        constructionUnit: values.constructionUnit,
        witnessUnit: values.witnessUnit,
        samplingLocation: values.samplingLocation,
        witness: values.witness,
        witnessPhone: values.witnessPhone,
        inspector: values.inspector,
        inspectorPhone: values.inspectorPhone,
        receivedBy: values.receivedBy,
        sampleSource: values.sampleSource,
        testCategory: values.testCategory,
        judgmentBasis: values.judgmentBasis,
        testingBasis: values.testingBasis,
        testParameters: values.testParameters,
        remark: values.remark,
      }
      if (formMode === 'create') {
        const res = await apiClient.post<SampleReceipt>(API_ROUTES['/receipts'], payload)
        setFormMode('edit')
        setEditing(res.data)
      } else if (editing) {
        await apiClient.put(`${API_ROUTES['/receipts']}/${editing.id}`, payload)
        setFormOpen(false)
      }
      await refreshRef.current?.()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`${API_ROUTES['/receipts']}/${deleteTarget.id}`)
      setDeleteTarget(null)
      await refreshRef.current?.()
    } finally {
      setDeleting(false)
    }
  }

  const toolbarAction = useCallback((refresh: () => Promise<void>) => {
    refreshRef.current = refresh
    return (
      <button
        onClick={() => {
          setFormMode('create')
        setEditing(null)
        setFormOpen(true)
        }}
        data-fn="M03.F01.I02"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        新建接样
      </button>
    )
  }, [])

  const rowActions = useCallback((r: SampleReceipt) => {
    if (r.flowStatus === 'receiving') {
      return (
        <ReceiptRowActions
          receipt={r}
          onEdit={(r) => {
            setFormMode('edit')
            setEditing(r)
            setFormOpen(true)
          }}
          onDelete={setDeleteTarget}
        />
      )
    }
    return <span className="text-gray-400 text-xs">已提交</span>
  }, [])

  return (
    // @entry M03.F01.I01
    // @entry M03.F01.I06
    <>
      <FlowStagePage
        title="接样管理"
        stage="receiving"
        submitLabel="提交"
        dataFn="M03.F01.I01"
        filterDataFn="M03.F01.I06"
        toolbar={toolbarAction}
        rowActions={rowActions}
      />

      <ReceiptFormModal
        open={formOpen}
        mode={formMode}
        initialValues={editing ?? undefined}
        contracts={contracts}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={submitting}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="删除确认"
        message={`确定删除接样「${deleteTarget?.commissionCode ?? ''}」？其下样品与检测记录将一并删除。`}
        confirmText="确认"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

export default ReceiptList
