import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import { FLOW_STAGE_LABELS, type SampleReceipt, type InspectionParameter as TestParameter, type InspectionReportName } from '@/types/api'
import type { InspectionStandard } from '@/types/inspection'
import { ReceiptDetail } from './ReceiptDetail'
import { ReportPreviewModal } from '@/features/data-entry/ReportPreviewModal'
import { paramLabel, categoryLabel, standardLabels } from './detailLabels'

// @entry M03.F09.I01
export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [receipt, setReceipt] = useState<SampleReceipt | null>(null)
  const [parameters, setParameters] = useState<TestParameter[]>([])
  const [reportNames, setReportNames] = useState<InspectionReportName[]>([])
  const [standards, setStandards] = useState<InspectionStandard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const fetchReceipt = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [receiptRes, paramRes, rnRes, stdRes] = await Promise.all([
        apiClient.get<SampleReceipt>(`${API_ROUTES['/receipts']}/${id}`),
        apiClient.get<{ items: TestParameter[] }>(API_ROUTES['/inspection-parameters'], { params: { page: 1, pageSize: 1000 } }),
        apiClient.get<{ items: InspectionReportName[] }>(API_ROUTES['/report-names'], { params: { page: 1, pageSize: 200 } }),
        apiClient.get<{ items: InspectionStandard[] }>(API_ROUTES['/inspection-standards'], { params: { page: 1, pageSize: 500 } }),
      ])
      setReceipt(receiptRes.data)
      setParameters(paramRes.data.items ?? [])
      setReportNames(rnRes.data.items ?? [])
      setStandards(stdRes.data.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchReceipt() }, [fetchReceipt])

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!receipt) return null

  const paramLabels = receipt.testParameters?.map(c => paramLabel(c, parameters)).join(', ') ?? '—'

  return (
    <div className="space-y-4" data-fn="M03.F09.I02">
      {/* 接样信息 —— 顺序与表单一致 */}
      <div className="bg-white rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-700">详情信息</h3>
          <div className="flex items-center gap-2">
            <button
              data-fn="M03.F09.I03"
              onClick={() => setPreviewOpen(true)}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded"
            >
              报告预览
            </button>
            <button onClick={() => window.history.back()} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 border rounded">关闭</button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-sm">
          {/* 委托书信息 */}
          <div><span className="text-gray-500">委托书编号：</span>{receipt.commissionCode}</div>
          <div><span className="text-gray-500">委托书登记号：</span>{receipt.commissionRegisterCode ?? '—'}</div>
          <div><span className="text-gray-500">委托日期：</span>{receipt.commissionDate}</div>
          <div><span className="text-gray-500">委托书登记日期：</span>{receipt.commissionRegisterDate ?? '—'}</div>
          {/* 从合同带出 */}
          <div><span className="text-gray-500">工程名称：</span>{receipt.projectName ?? '—'}</div>
          <div><span className="text-gray-500">委托单位：</span>{receipt.clientUnit ?? '—'}</div>
          <div><span className="text-gray-500">建设单位：</span>{receipt.buildingUnit ?? '—'}</div>
          <div><span className="text-gray-500">监理单位：</span>{receipt.supervisorUnit ?? '—'}</div>
          <div><span className="text-gray-500">施工单位：</span>{receipt.constructionUnit ?? '—'}</div>
          <div><span className="text-gray-500">见证单位：</span>{receipt.witnessUnit ?? '—'}</div>
          <div><span className="text-gray-500">见证人：</span>{receipt.witness ?? '—'}</div>
          <div><span className="text-gray-500">见证人电话：</span>{receipt.witnessPhone ?? '—'}</div>
          <div><span className="text-gray-500">送检人：</span>{receipt.inspector ?? '—'}</div>
          <div><span className="text-gray-500">送检人电话：</span>{receipt.inspectorPhone ?? '—'}</div>
          {/* 取样信息 */}
          <div><span className="text-gray-500">取样地点：</span>{receipt.samplingLocation ?? '—'}</div>
          <div><span className="text-gray-500">接样人：</span>{receipt.receivedBy}</div>
          {/* 报告类别 + 检测类别 */}
          <div><span className="text-gray-500">报告类别：</span>{categoryLabel(receipt.categoryCode, reportNames)}</div>
          <div><span className="text-gray-500">检测类别：</span>{receipt.testCategory}</div>
          <div><span className="text-gray-500">样品来源：</span>{receipt.sampleSource}</div>
          <div><span className="text-gray-500">合同编号：</span>{receipt.contractId}</div>
          {/* 判定/检测依据 + 参数 */}
          <div className="col-span-2"><span className="text-gray-500">判定依据：</span>{standardLabels(receipt.judgmentBasis, standards)}</div>
          <div className="col-span-2"><span className="text-gray-500">检测依据：</span>{standardLabels(receipt.testingBasis, standards)}</div>
          <div className="col-span-4"><span className="text-gray-500">检测参数：</span>{paramLabels}</div>
          {/* 流程信息 */}
          <div><span className="text-gray-500">流程状态：</span>{FLOW_STAGE_LABELS[receipt.flowStatus]}</div>
          <div><span className="text-gray-500">检测结果：</span>{receipt.result ? (receipt.result === 'pass' ? '合格' : '不合格') : '—'}</div>
          {receipt.reportCode && <div><span className="text-gray-500">报告编号：</span>{receipt.reportCode}</div>}
          {receipt.assigneeName && <div><span className="text-gray-500">检测负责人：</span>{receipt.assigneeName}</div>}
          {receipt.plannedTestDate && <div><span className="text-gray-500">计划检测日期：</span>{receipt.plannedTestDate}</div>}
          {/* 检测信息（数据录入环节维护） */}
          <div><span className="text-gray-500">检测环境：</span>{receipt.testEnvironment ?? '—'}</div>
          <div><span className="text-gray-500">主要设备：</span>{receipt.mainEquipment ?? '—'}</div>
          <div><span className="text-gray-500">检测人员：</span>{receipt.testOperator ?? '—'}</div>
          <div><span className="text-gray-500">原始记录单号：</span>{receipt.originalRecordNo ?? '—'}</div>
          <div><span className="text-gray-500">开始日期：</span>{receipt.testStartDate ?? '—'}</div>
          <div><span className="text-gray-500">结束日期：</span>{receipt.testEndDate ?? '—'}</div>
          {receipt.remark && <div className="col-span-4"><span className="text-gray-500">备注：</span>{receipt.remark}</div>}
        </div>
      </div>

      {/* 样品信息 + 检测数据 */}
      <ReceiptDetail
        receiptId={receipt.id}
        categoryCode={receipt.categoryCode}
      />

      {previewOpen && (
        <ReportPreviewModal
          open
          receipt={receipt}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

export default ReceiptDetailPage
