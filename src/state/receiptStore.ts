import { create } from 'zustand'
import type {
  SampleReceipt,
  FlowAction,
  FlowActionResult,
  FlowStatus,
  CreateSampleReceiptRequest,
  ReceiptsListReceiptsParams,
  UpdateSampleReceiptRequest,
} from '@/api/endpoints/model'
import {
  receiptsListReceipts,
  receiptsCreateReceipt,
  receiptsUpdateReceipt,
  receiptsDeleteReceipt,
} from '@/api/endpoints/receipts/receipts'
import { ACT_BY_STAGE } from '@/features/flow-pipeline/flow-stages'

/** 接样单 store 状态切片（原 @/types/store ReceiptState，TSOT 清理 Phase C2 内联） */
interface ReceiptState {
  list: SampleReceipt[]
  total: number
  current: SampleReceipt | null
  loading: boolean
  error: string | null
}

export interface ReceiptQueryInput {
  page: number
  pageSize: number
  keyword?: string
  categoryCode?: string
  contractId?: string
  /** v2.0：按流程阶段过滤（各阶段页面使用） */
  flowStatus?: FlowStatus
  /** v2.0：按最近提交人过滤（撤回视图使用） */
  lastSubmittedBy?: string
}

/**
 * receipts list 查询参数：shared 契约 ReceiptsListReceiptsParams 之外，
 * categoryCode / lastSubmittedBy 后端 route 已支持但尚未进 shared tsp——
 * 消费侧以交集类型显式声明（见迁移汇报）。
 */
type ReceiptListQuery = ReceiptsListReceiptsParams & {
  categoryCode?: string
  lastSubmittedBy?: string
}

interface ReceiptActions {
  fetchReceipts: (query: ReceiptQueryInput) => Promise<void>
  createReceipt: (input: CreateSampleReceiptRequest) => Promise<void>
  updateReceipt: (id: string, input: Partial<SampleReceipt>) => Promise<void>
  deleteReceipt: (id: string) => Promise<void>
  /**
   * v2.0 流程操作（M03 7 阶段全 act 模式，ADR-0035）：按 stage 调对应 act 端点
   * （POST /api/receipts/{stage}/act），后端 stage-guard 校验单据停在该阶段；
   * 响应是 FlowActionResult[] 裸数组。提交（前进）/退回（后退）/撤回，均支持批量。
   */
  flowAction: (
    stage: Exclude<FlowStatus, 'completed'>,
    action: FlowAction,
    ids: string[],
    operator: string,
    reason?: string,
  ) => Promise<FlowActionResult[]>
  clearError: () => void
}

export type ReceiptStore = ReceiptState & ReceiptActions

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } }
    message?: string
  }
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message
  if (axiosErr.message) return axiosErr.message
  return '操作失败'
}

export const useReceiptStore = create<ReceiptStore>()((set, get) => ({
  list: [],
  total: 0,
  current: null,
  loading: false,
  error: null,

  fetchReceipts: async (query) => {
    set({ loading: true, error: null })
    try {
      const params: ReceiptListQuery = {
        page: query.page,
        pageSize: query.pageSize,
      }
      if (query.keyword) params.keyword = query.keyword
      if (query.categoryCode) params.categoryCode = query.categoryCode
      if (query.contractId) params.contractId = query.contractId
      if (query.flowStatus) params.flowStatus = query.flowStatus
      if (query.lastSubmittedBy) params.lastSubmittedBy = query.lastSubmittedBy
      const res = await receiptsListReceipts(params)
      set({ list: res.items, total: res.total, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) })
    }
  },

  createReceipt: async (input) => {
    set({ error: null })
    try {
      const created = await receiptsCreateReceipt(input)
      set({ list: [created, ...get().list], total: get().total + 1, error: null })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  updateReceipt: async (id, input) => {
    set({ error: null })
    try {
      const updated = await receiptsUpdateReceipt(id, input as UpdateSampleReceiptRequest)
      set({
        list: get().list.map((r) => (r.id === id ? updated : r)),
        current: get().current?.id === id ? updated : get().current,
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  deleteReceipt: async (id) => {
    set({ error: null })
    try {
      await receiptsDeleteReceipt(id)
      set({
        list: get().list.filter((r) => r.id !== id),
        total: Math.max(0, get().total - 1),
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  flowAction: async (stage, action, ids, operator, reason) => {
    set({ error: null })
    try {
      const results = await ACT_BY_STAGE[stage]({ action, ids, operator, reason })
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        set({ error: failed.map((f) => f.message).join('；') })
      }
      return results
    } catch (err) {
      set({ error: extractErrorMessage(err) })
      return ids.map((id) => ({ id, ok: false, message: extractErrorMessage(err) }))
    }
  },

  clearError: () => set({ error: null }),
}))
