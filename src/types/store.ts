// Store 状态切片类型（v3）

import type { User, Contract, SampleReceipt, Sample } from './api'

/** 认证状态机 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

/** 认证状态 */
export interface AuthState {
  user: User | null
  token: string | null
  status: AuthStatus
  error: string | null
}

/** 合同 store 状态切片 */
export interface ContractState {
  list: Contract[]
  total: number
  current: Contract | null
  loading: boolean
  error: string | null
}

/** 接样单 store 状态切片（含报告字段：reportCode/conclusion/result/issuedAt 等） */
export interface ReceiptState {
  list: SampleReceipt[]
  total: number
  current: SampleReceipt | null
  loading: boolean
  error: string | null
}

/** 样品 store 状态切片 */
export interface SampleState {
  list: Sample[]
  total: number
  current: Sample | null
  loading: boolean
  error: string | null
}

// 注：原 ReportState / ReportStateV2 / TaskState 已删除——报告与任务数据合并到 SampleReceipt（接样单合并报告字段 + 任务安排字段）。