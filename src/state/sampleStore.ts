import { create } from 'zustand'
import type { SampleState } from '@/types/store'
import type { Sample, SampleQuery, SampleCreateInput, SampleUpdateInput } from '@/types/api'
import { apiClient, API_ROUTES } from '@/api/legacy-client'

interface SampleActions {
  /** 拉取样品列表（支持分页/搜索/过滤） */
  fetchSamples: (query: SampleQuery) => Promise<void>
  /** 新建样品，成功后追加到当前 list */
  createSample: (input: SampleCreateInput) => Promise<void>
  /** 更新样品，成功后同步 list 中对应项 */
  updateSample: (id: string, input: SampleUpdateInput) => Promise<void>
  /** 删除样品，成功后从 list 移除 */
  deleteSample: (id: string) => Promise<void>
  /** 清除错误信息 */
  clearError: () => void
}

export type SampleStore = SampleState & SampleActions

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } }
    message?: string
  }
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message
  if (axiosErr.message) return axiosErr.message
  return '操作失败'
}

export const useSampleStore = create<SampleStore>()((set, get) => ({
  list: [],
  total: 0,
  current: null,
  loading: false,
  error: null,

  fetchSamples: async (query) => {
    set({ loading: true, error: null })
    try {
      const params: Record<string, string> = {
        page: String(query.page),
        pageSize: String(query.pageSize),
      }
      if (query.keyword) params.keyword = query.keyword
      if (query.status) params.status = query.status
      if (query.projectId) params.projectId = query.projectId
      const res = await apiClient.get<{ items: Sample[]; total: number; page: number; pageSize: number }>(
        API_ROUTES['/samples'],
        { params },
      )
      set({ list: res.data.items, total: res.data.total, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) })
    }
  },

  createSample: async (input) => {
    set({ error: null })
    try {
      const res = await apiClient.post<Sample>(API_ROUTES['/samples'], input)
      set({ list: [res.data, ...get().list], total: get().total + 1, error: null })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  updateSample: async (id, input) => {
    set({ error: null })
    try {
      const res = await apiClient.put<Sample>(`${API_ROUTES['/samples']}/${id}`, input)
      set({
        list: get().list.map((s) => (s.id === id ? res.data : s)),
        current: get().current?.id === id ? res.data : get().current,
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  deleteSample: async (id) => {
    set({ error: null })
    try {
      await apiClient.delete(`${API_ROUTES['/samples']}/${id}`)
      set({
        list: get().list.filter((s) => s.id !== id),
        total: Math.max(0, get().total - 1),
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  clearError: () => set({ error: null }),
}))
