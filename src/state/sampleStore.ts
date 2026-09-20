import { create } from "zustand";
import type {
  Sample,
  CreateSampleRequest,
  UpdateSampleRequest,
} from "@/api/endpoints/model";
import {
  samplesListSamples,
  samplesCreateSample,
  samplesUpdateSample,
  samplesDeleteSample,
} from "@/api/endpoints/samples/samples";

/** 样品 store 状态切片（原 @/types/store SampleState，TSOT 清理 Phase C2 内联） */
interface SampleState {
  list: Sample[];
  total: number;
  current: Sample | null;
  loading: boolean;
  error: string | null;
}

/** 样品查询入参（契约 SamplesListSamplesParams：page/pageSize/receiptId/keyword） */
export interface SampleQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  receiptId?: string;
}

interface SampleActions {
  /** 拉取样品列表（支持分页/搜索/过滤） */
  fetchSamples: (query: SampleQuery) => Promise<void>;
  /** 新建样品，成功后追加到当前 list */
  createSample: (input: CreateSampleRequest) => Promise<void>;
  /** 更新样品，成功后同步 list 中对应项 */
  updateSample: (id: string, input: UpdateSampleRequest) => Promise<void>;
  /** 删除样品，成功后从 list 移除 */
  deleteSample: (id: string) => Promise<void>;
  /** 清除错误信息 */
  clearError: () => void;
}

export type SampleStore = SampleState & SampleActions;

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  if (axiosErr.message) return axiosErr.message;
  return "操作失败";
}

export const useSampleStore = create<SampleStore>()((set, get) => ({
  list: [],
  total: 0,
  current: null,
  loading: false,
  error: null,

  fetchSamples: async (query) => {
    set({ loading: true, error: null });
    try {
      const res = await samplesListSamples({
        page: query.page,
        pageSize: query.pageSize,
        keyword: query.keyword,
        receiptId: query.receiptId,
      });
      set({ list: res.items, total: res.total, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err) });
    }
  },

  createSample: async (input) => {
    set({ error: null });
    try {
      const created = await samplesCreateSample(input);
      set({ list: [created, ...get().list], total: get().total + 1, error: null });
    } catch (err) {
      set({ error: extractErrorMessage(err) });
    }
  },

  updateSample: async (id, input) => {
    set({ error: null });
    try {
      const updated = await samplesUpdateSample(id, input);
      set({
        list: get().list.map((s) => (s.id === id ? updated : s)),
        current: get().current?.id === id ? updated : get().current,
        error: null,
      });
    } catch (err) {
      set({ error: extractErrorMessage(err) });
    }
  },

  deleteSample: async (id) => {
    set({ error: null });
    try {
      await samplesDeleteSample(id);
      set({
        list: get().list.filter((s) => s.id !== id),
        total: Math.max(0, get().total - 1),
        error: null,
      });
    } catch (err) {
      set({ error: extractErrorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
