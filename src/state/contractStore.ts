import { create } from 'zustand'
import type { ContractState } from '@/types/store'
import type { Contract, ContractStatus } from '@/types/api'
import { apiClient, API_ROUTES } from '@/api/legacy-client'

interface ContractActions {
  fetchContracts: (query: { page: number; pageSize: number; keyword?: string; status?: ContractStatus }) => Promise<void>
  createContract: (input: { contractCode: string; clientUnit: string; projectName: string; constructionUnit: string; inspectionSpecialtyCode?: string; buildingUnit?: string; supervisorUnit?: string; inspectionPerson?: string; inspectionPhone?: string; witnessUnit: string; witness: string }) => Promise<void>
  updateContract: (id: string, input: Partial<Contract>) => Promise<void>
  deleteContract: (id: string) => Promise<void>
  clearError: () => void
}

export type ContractStore = ContractState & ContractActions

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } }
    message?: string
  }
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message
  if (axiosErr.message) return axiosErr.message
  return '操作失败'
}

export const useContractStore = create<ContractStore>()((set, get) => ({
  list: [],
  total: 0,
  current: null,
  loading: false,
  error: null,

  fetchContracts: async (query) => {
    set({ loading: true, error: null })
    try {
      const params: Record<string, string> = {
        page: String(query.page),
        pageSize: String(query.pageSize),
      }
      if (query.keyword) params.keyword = query.keyword
      if (query.status) params.status = query.status
      const res = await apiClient.get<{ items: Contract[]; total: number; page: number; pageSize: number }>(
        API_ROUTES['/contracts'],
        { params },
      )
      set({ list: res.data.items, total: res.data.total, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) })
    }
  },

  createContract: async (input) => {
    set({ error: null })
    try {
      const res = await apiClient.post<Contract>(API_ROUTES['/contracts'], input)
      set({ list: [res.data, ...get().list], total: get().total + 1, error: null })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  updateContract: async (id, input) => {
    set({ error: null })
    try {
      const res = await apiClient.put<Contract>(`${API_ROUTES['/contracts']}/${id}`, input)
      set({
        list: get().list.map((c) => (c.id === id ? res.data : c)),
        current: get().current?.id === id ? res.data : get().current,
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  deleteContract: async (id) => {
    set({ error: null })
    try {
      await apiClient.delete(`${API_ROUTES['/contracts']}/${id}`)
      set({
        list: get().list.filter((c) => c.id !== id),
        total: Math.max(0, get().total - 1),
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  clearError: () => set({ error: null }),
}))
