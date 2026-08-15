"use client";
// REF src/features/inspection-capability/InspectionCapabilityPage.tsx 移植。
// 差异：react-router useParams → props（Next.js App Router 路由壳传 resource）；
// apiClient → @/api/legacy-client + API_ROUTES；类型从 @/types/inspection 取。
// standards 状态列 msw seeds 无 status 字段，回退 '-'（REF 有 status 枚举）。
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import type {
  InspectionSpecialty,
  InspectionObject,
  InspectionParameter,
  InspectionStandard,
} from "@/types/inspection";
import { InspectionCapabilityFormModal } from "./InspectionCapabilityFormModal";
import { ConfirmModal } from "@/components/ConfirmModal";

const PAGE_SIZE = 50;

type ResourceKey = "specialties" | "objects" | "parameters" | "standards";

const TITLES: Record<ResourceKey, string> = {
  specialties: "检测专项",
  objects: "检测项目",
  parameters: "检测参数",
  standards: "检测标准",
};

const CREATE_LABELS: Record<ResourceKey, string> = {
  specialties: "新建专项",
  objects: "新建项目",
  parameters: "新建参数",
  standards: "新建标准",
};

/** REF PATHS 键 → lab-msw 路由（API_ROUTES 查表；键集合封闭，必有命中）。 */
const ROUTES: Record<ResourceKey, string> = {
  specialties: API_ROUTES["/inspection-specialties"],
  objects: API_ROUTES["/inspection-objects"],
  parameters: API_ROUTES["/inspection-parameters"],
  standards: API_ROUTES["/inspection-standards"],
};

const FN_ID: Record<ResourceKey, string> = {
  specialties: "M06.F01.I01",
  objects: "M06.F02.I01",
  parameters: "M06.F03.I01",
  standards: "M06.F04.I01",
};

const FN_CREATE: Record<ResourceKey, string> = {
  specialties: "M06.F01.I02", // @entry M06.F01.I02 新建/编辑专项按钮（页面顶部"新建专项"+ 行内"编辑"）
  objects: "M06.F02.I02", // @entry M06.F02.I02 新建/编辑项目按钮
  parameters: "M06.F03.I02", // @entry M06.F03.I02 新建/编辑参数按钮
  standards: "M06.F04.I02", // @entry M06.F04.I02 新建/编辑标准按钮
};

const FN_DELETE: Record<ResourceKey, string> = {
  specialties: "M06.F01.I03", // @entry M06.F01.I03 删除专项按钮（行内"删除"，触发 ConfirmModal）
  objects: "M06.F02.I03", // @entry M06.F02.I03 删除项目按钮
  parameters: "M06.F03.I03", // @entry M06.F03.I03 删除参数按钮
  standards: "M06.F04.I03", // @entry M06.F04.I03 删除标准按钮
};

interface ResourceState {
  items: Array<
    InspectionSpecialty | InspectionObject | InspectionParameter | InspectionStandard
  >;
  total: number;
  loading: boolean;
  error: string | null;
}

function rowId(item: ResourceState["items"][number]): string {
  return (item as { id: string }).id;
}

function isOfficialRow(
  key: ResourceKey,
  item: ResourceState["items"][number],
): boolean {
  if (key === "specialties" || key === "objects")
    return (item as { isOfficial?: boolean }).isOfficial === true;
  if (key === "parameters")
    return (item as { sourceType?: string }).sourceType === "official";
  return (item as { sourceDocumentId?: string }).sourceDocumentId != null;
}

export interface InspectionCapabilityPageProps {
  resource?: ResourceKey;
}

const STANDARD_STATUS_CN: Record<string, string> = {
  active: "现行",
  superseded: "被替代",
  draft: "草案",
};

interface AggRow {
  code: string;
  name: string;
  officialNo?: string;
  enabled?: boolean;
  sourceType?: string;
  status?: string;
  unit?: string;
  parameterNames?: string;
  standardCodes?: string;
  objectNames?: string;
}

interface Column {
  header: string;
  cell: (i: AggRow) => ReactNode;
}

const codeCell = (i: AggRow): ReactNode => (
  <span className="font-mono text-xs">{i.code}</span>
);
const aggCell = (v?: string): ReactNode => (
  <span className="text-xs text-gray-500 line-clamp-2 inline-block max-w-75 wrap-break-word align-top">
    {v && v.length > 0 ? v : "-"}
  </span>
);

const COLUMNS: Record<ResourceKey, Column[]> = {
  specialties: [
    { header: "编码", cell: codeCell },
    { header: "名称", cell: (i) => i.name },
    { header: "状态", cell: (i) => (i.enabled ? "启用" : "停用") },
  ],
  objects: [
    { header: "编码", cell: codeCell },
    { header: "名称", cell: (i) => i.name },
    { header: "检测参数", cell: (i) => aggCell(i.parameterNames) },
    { header: "检测标准", cell: (i) => aggCell(i.standardCodes) },
    { header: "状态", cell: (i) => (i.enabled ? "启用" : "停用") },
  ],
  parameters: [
    { header: "编码", cell: codeCell },
    { header: "名称", cell: (i) => i.name },
    { header: "单位", cell: (i) => i.unit || "-" },
    { header: "检测项目", cell: (i) => aggCell(i.objectNames) },
    { header: "检测标准", cell: (i) => aggCell(i.standardCodes) },
  ],
  standards: [
    { header: "编码", cell: codeCell },
    { header: "名称", cell: (i) => i.name },
    {
      header: "状态",
      cell: (i) => STANDARD_STATUS_CN[i.status ?? ""] ?? i.status ?? "-",
    },
    { header: "检测参数", cell: (i) => aggCell(i.parameterNames) },
  ],
};

export function InspectionCapabilityPage(props: InspectionCapabilityPageProps = {}) {
  const key = (props.resource ?? "specialties") as ResourceKey;
  const [state, setState] = useState<ResourceState>({
    items: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceState["items"][number] | null>(null);
  const [deleting, setDeleting] = useState<ResourceState["items"][number] | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [specialtyOptions, setSpecialtyOptions] = useState<InspectionSpecialty[]>([]);
  const [objectFilter, setObjectFilter] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [objectOptions, setObjectOptions] = useState<InspectionObject[]>([]);
  const [standardOptions, setStandardOptions] = useState<InspectionStandard[]>([]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`${ROUTES[key]}/${rowId(deleting)}`);
      setDeleting(null);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "删除失败";
      setDeleteError(msg);
    } finally {
      setDeletingBusy(false);
    }
  };

  const load = () => {
    const controller = new AbortController();
    setState({ items: [], total: 0, loading: true, error: null });
    const params: {
      page: number;
      pageSize: string;
      keyword?: string;
      inspectionSpecialtyCode?: string;
      inspectionObjectCode?: string;
      inspectionStandardCode?: string;
    } = {
      page,
      pageSize: String(PAGE_SIZE),
    };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (key === "objects" && specialtyFilter)
      params.inspectionSpecialtyCode = specialtyFilter;
    if (key === "standards") {
      if (specialtyFilter) params.inspectionSpecialtyCode = specialtyFilter;
      if (objectFilter) params.inspectionObjectCode = objectFilter;
    }
    if (key === "parameters") {
      if (specialtyFilter) params.inspectionSpecialtyCode = specialtyFilter;
      if (objectFilter) params.inspectionObjectCode = objectFilter;
      if (standardFilter) params.inspectionStandardCode = standardFilter;
    }
    apiClient
      .get<{ items: ResourceState["items"]; total: number }>(ROUTES[key], {
        params,
        signal: controller.signal,
      })
      .then((res) =>
        setState({
          items: Array.isArray(res.data?.items) ? res.data.items : [],
          total: typeof res.data?.total === "number" ? res.data.total : 0,
          loading: false,
          error: Array.isArray(res.data?.items) ? null : "加载失败：响应格式异常",
        }),
      )
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          items: [],
          total: 0,
          loading: false,
          error: err instanceof Error ? err.message : "加载失败",
        });
      });
    return () => controller.abort();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [key, specialtyFilter, objectFilter, standardFilter, keyword, page]);

  // 专项下拉选项（objects/standards/parameters，专项页本身不需要筛专项）
  useEffect(() => {
    if (key === "specialties") {
      setSpecialtyOptions([]);
      return;
    }
    const controller = new AbortController();
    apiClient
      .get<{ items: InspectionSpecialty[] }>(ROUTES.specialties, {
        params: { page: 1, pageSize: "100" },
        signal: controller.signal,
      })
      .then((res) =>
        setSpecialtyOptions(Array.isArray(res.data?.items) ? res.data.items : []),
      )
      .catch(() => {
        /* 下拉加载失败不阻塞主列表 */
      });
    return () => controller.abort();
  }, [key]);

  // 项目下拉选项（standards/parameters，按选中专项过滤）
  useEffect(() => {
    if (key !== "standards" && key !== "parameters") {
      setObjectOptions([]);
      return;
    }
    const controller = new AbortController();
    const params: {
      page: number;
      pageSize: string;
      inspectionSpecialtyCode?: string;
    } = { page: 1, pageSize: "200" };
    if (specialtyFilter) params.inspectionSpecialtyCode = specialtyFilter;
    apiClient
      .get<{ items: InspectionObject[] }>(ROUTES.objects, {
        params,
        signal: controller.signal,
      })
      .then((res) =>
        setObjectOptions(Array.isArray(res.data?.items) ? res.data.items : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [key, specialtyFilter]);

  // 标准下拉选项（parameters，按选中项目过滤）
  useEffect(() => {
    if (key !== "parameters") {
      setStandardOptions([]);
      return;
    }
    const controller = new AbortController();
    const params: {
      page: number;
      pageSize: string;
      inspectionObjectCode?: string;
    } = { page: 1, pageSize: "200" };
    if (objectFilter) params.inspectionObjectCode = objectFilter;
    apiClient
      .get<{ items: InspectionStandard[] }>(ROUTES.standards, {
        params,
        signal: controller.signal,
      })
      .then((res) =>
        setStandardOptions(Array.isArray(res.data?.items) ? res.data.items : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [key, objectFilter]);

  return (
    <div className="space-y-4" data-fn={FN_ID[key]}>
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{TITLES[key]}</h2>
        <div className="flex items-center gap-2">
          <input
            aria-label="搜索"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="搜索编码/名称"
            className="px-2 py-1.5 text-sm border rounded"
          />
          {key !== "specialties" && (
            <select
              aria-label="检测专项筛选"
              value={specialtyFilter}
              onChange={(e) => {
                setSpecialtyFilter(e.target.value);
                setObjectFilter("");
                setStandardFilter("");
                setPage(1);
              }}
              className="px-2 py-1.5 text-sm border rounded"
            >
              <option value="">全部专项</option>
              {specialtyOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {(key === "standards" || key === "parameters") && (
            <select
              aria-label="检测项目筛选"
              value={objectFilter}
              onChange={(e) => {
                setObjectFilter(e.target.value);
                setStandardFilter("");
                setPage(1);
              }}
              className="px-2 py-1.5 text-sm border rounded"
            >
              <option value="">全部项目</option>
              {objectOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          {key === "parameters" && (
            <select
              aria-label="检测标准筛选"
              value={standardFilter}
              onChange={(e) => {
                setStandardFilter(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 text-sm border rounded"
            >
              <option value="">全部标准</option>
              {standardOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-fn={FN_CREATE[key]}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {CREATE_LABELS[key]}
          </button>
        </div>
      </header>
      <p className="text-xs text-gray-500">
        数据源：src/data/generated/inspection-*.json（按类型分文件）
      </p>
      {state.error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {state.error}
        </div>
      )}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {COLUMNS[key].map((c) => (
                <th key={c.header} className="px-4 py-2 text-left">
                  {c.header}
                </th>
              ))}
              <th className="px-4 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {state.loading && state.items.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS[key].length + 1}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  加载中...
                </td>
              </tr>
            )}
            {!state.loading && state.items.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS[key].length + 1}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  暂无数据
                </td>
              </tr>
            )}
            {state.items.map((item) => (
              <tr
                key={(item as { code: string }).code}
                className="border-t hover:bg-gray-50"
              >
                {COLUMNS[key].map((c) => (
                  <td key={c.header} className="px-4 py-2 align-top">
                    {c.cell(item as AggRow)}
                  </td>
                ))}
                <td className="px-4 py-2 text-xs whitespace-nowrap align-top">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    data-fn={FN_CREATE[key]}
                    aria-label={`编辑 ${(item as { code: string }).code}`}
                    className="text-blue-600 hover:underline disabled:opacity-40 mr-3"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(item);
                      setDeleteError(null);
                    }}
                    data-fn={FN_DELETE[key]}
                    aria-label={`删除 ${(item as { code: string }).code}`}
                    disabled={isOfficialRow(key, item)}
                    className="text-red-600 hover:underline disabled:opacity-40"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共 {state.total} 条</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            上一页
          </button>
          <span>
            第 {page} / {Math.max(1, Math.ceil(state.total / PAGE_SIZE))} 页
          </span>
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= Math.ceil(state.total / PAGE_SIZE)}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
      <InspectionCapabilityFormModal
        resource={key}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => load()}
      />
      <InspectionCapabilityFormModal
        resource={key}
        open={editing !== null}
        editing={editing ? { id: rowId(editing), ...(editing as object) } : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <ConfirmModal
        open={deleting !== null}
        title={`删除${TITLES[key]}`}
        message={
          <>
            确定删除 {(deleting as { code?: string } | null)?.code ?? ""}？
            官方数据与被引用数据不可删除。
            {deleteError && (
              <div role="alert" className="mt-2 text-red-600">
                {deleteError}
              </div>
            )}
          </>
        }
        loading={deletingBusy}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

export default InspectionCapabilityPage;
