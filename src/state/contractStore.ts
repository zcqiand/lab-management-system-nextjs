import { create } from 'zustand'
import type { Contract, ContractStatus } from '@/api/endpoints/model'
import {
  contractsListContracts,
  contractsCreateContract,
  contractsUpdateContract,
  contractsDeleteContract,
} from '@/api/endpoints/contracts/contracts'

/** 合同 store 状态切片（原 @/types/store ContractState，TSOT 清理 Phase C2 内联） */
interface ContractState {
  list: Contract[]
  total: number
  current: Contract | null
  loading: boolean
  error: string | null
}

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
      const res = await contractsListContracts({
        page: query.page,
        pageSize: query.pageSize,
        keyword: query.keyword,
        status: query.status,
      })
      set({ list: res.items, total: res.total, loading: false, error: null })
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) })
    }
  },

  createContract: async (input) => {
    set({ error: null })
    try {
      const created = await contractsCreateContract(input)
      set({ list: [created, ...get().list], total: get().total + 1, error: null })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  updateContract: async (id, input) => {
    set({ error: null })
    try {
      const updated = await contractsUpdateContract(id, input)
      set({
        list: get().list.map((c) => (c.id === id ? updated : c)),
        current: get().current?.id === id ? updated : get().current,
        error: null,
      })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },

  deleteContract: async (id) => {
    set({ error: null })
    try {
      await contractsDeleteContract(id)
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
