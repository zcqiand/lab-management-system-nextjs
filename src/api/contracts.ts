// Contracts — TanStack Query 包装 + 客户端 store
//
// 不走 orval 端到端（@lab/management-system-msw 的 fixtures 在同进程；
// 同源 fetch /api/contracts 比 axios 更直接）；axios 留作 lab-msw / 跨仓 fallback。

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

export type Contract = {
  id: string;
  tenantId: string;
  contractCode: string;
  clientUnit: string;
  projectName: string;
  projectLocation?: string;
  constructionUnit: string;
  inspectionSpecialtyCode?: string;
  buildingUnit?: string;
  supervisorUnit?: string;
  inspectionPerson?: string;
  inspectionPhone?: string;
  witnessUnit: string;
  witness: string;
  witnessPhone?: string;
  contactPerson?: string;
  contactPhone?: string;
  entrustedDate?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ContractsListResponse = {
  items: Contract[];
  page: number;
  pageSize: number;
  total: number;
};

export type ContractFilters = {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

function toQuery(filters: ContractFilters): string {
  const sp = new URLSearchParams();
  if (filters.status) sp.set("status", filters.status);
  if (filters.keyword) sp.set("keyword", filters.keyword);
  if (filters.page) sp.set("page", String(filters.page));
  if (filters.pageSize) sp.set("pageSize", String(filters.pageSize));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function useContracts(
  filters: ContractFilters = {},
  options?: Omit<UseQueryOptions<ContractsListResponse, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<ContractsListResponse, Error>({
    queryKey: ["contracts", filters],
    queryFn: () => fetchJson<ContractsListResponse>(`/api/contracts${toQuery(filters)}`),
    staleTime: 30_000,
    ...options,
  });
}

export function useContract(id: string | null | undefined) {
  return useQuery<Contract, Error>({
    queryKey: ["contract", id],
    queryFn: () => fetchJson<Contract>(`/api/contracts/${id}`),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

type CreateContractBody = Omit<Contract, "id" | "createdAt" | "updatedAt">;
type UpdateContractBody = Partial<
  Omit<Contract, "id" | "tenantId" | "createdAt" | "updatedAt">
>;

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation<Contract, Error, CreateContractBody>({
    mutationFn: (body) =>
      fetchJson<Contract>("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useUpdateContract(id: string) {
  const qc = useQueryClient();
  return useMutation<Contract, Error, UpdateContractBody>({
    mutationFn: (body) =>
      fetchJson<Contract>(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.setQueryData(["contract", id], data);
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => fetchJson<void>(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
