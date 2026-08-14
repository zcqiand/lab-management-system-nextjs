import { create } from 'zustand'
import type { DateRangeFilter } from '@/types/api'
import { apiClient, API_ROUTES } from '@/api/legacy-client'

/** 审计日志类型 */
export type AuditType =
  | 'auth'      // 认证操作：登录/登出/改密
  | 'contract'  // 合同操作
  | 'receipt'   // 接样操作
  | 'flow'      // 流程操作：提交/退回/撤回
  | 'report'    // 报告操作
  | 'user'      // 用户管理
  | 'role'      // 角色管理
  | 'system'    // 系统设置

/** 审计日志条目 */
export interface AuditEntry {
  id: string
  /** 日志类型 */
  type: AuditType
  /** 操作名称 */
  action: string
  /** 操作人 */
  operator: string
  /** 操作对象描述 */
  target: string
  /** 操作对象 ID */
  targetId?: string
  /** 操作的详细信息 */
  detail?: string
  /** 操作时间 */
  at: string
  /** IP 地址 */
  ip?: string
}

/** 审计日志分页响应 */
export interface AuditPage {
  items: AuditEntry[]
  total: number
  page: number
  pageSize: number
}

/** 审计日志查询参数 */
export interface AuditQuery extends DateRangeFilter {
  page: number
  pageSize: number
  keyword?: string
  type?: AuditType
}

/** 审计 store 状态 */
export interface AuditState {
  list: AuditEntry[]
  total: number
  loading: boolean
  error: string | null
}

/** 审计导出格式 */
export type AuditExportFormat = 'json' | 'csv'

interface AuditActions {
  fetchLogs: (query: AuditQuery) => Promise<void>
  /** 导出审计日志（返回 Blob） */
  exportLogs: (query: AuditQuery, format: AuditExportFormat) => Promise<Blob>
  clearError: () => void
}

export type AuditStore = AuditState & AuditActions

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { message?: string }; message?: string }; message?: string }
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message
  if (axiosErr.message) return axiosErr.message
  return '操作失败'
}

export const useAuditStore = create<AuditStore>()((set, get) => ({
  list: [],
  total: 0,
  loading: false,
  error: null,

  fetchLogs: async (query) => {
    set({ loading: true, error: null })
    try {
      const params: Record<string, string> = {
        page: String(query.page),
        pageSize: String(query.pageSize),
      }
      if (query.keyword) params.keyword = query.keyword
      if (query.type) params.type = query.type
      if (query.dateFrom) params.dateFrom = query.dateFrom
      if (query.dateTo) params.dateTo = query.dateTo
      const res = await apiClient.get<AuditPage>(API_ROUTES['/audit-logs'], { params })
      set({ list: res.data.items, total: res.data.total, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) })
    }
  },

  exportLogs: async (query, format) => {
    const params: Record<string, string> = {
      page: '1',
      pageSize: String(get().total || 10000),
    }
    if (query.keyword) params.keyword = query.keyword
    if (query.type) params.type = query.type
    if (query.dateFrom) params.dateFrom = query.dateFrom
    if (query.dateTo) params.dateTo = query.dateTo

    const res = await apiClient.get<AuditPage>(API_ROUTES['/audit-logs'], { params })
    const items = res.data.items

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
      return blob
    }

    // CSV export
    const headers = ['ID', '类型', '操作', '操作人', '操作对象', '对象ID', '详情', '时间', 'IP地址']
    const rows = items.map((e) => [
      e.id,
      e.type,
      e.action,
      e.operator,
      e.target,
      e.targetId ?? '',
      e.detail ?? '',
      e.at,
      e.ip ?? '',
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const BOM = '﻿'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    return blob
  },

  clearError: () => set({ error: null }),
}))
