import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { useAuthStore } from "@/state/authStore";
import {
  FLOW_STAGE_LABELS,
  FLOW_STAGE_ORDER,
  type FlowAction,
  type FlowActionResult,
  type FlowStage,
  type SampleReceipt,
  type Contract,
  type InspectionReportName,
} from "@/types/api";

const PAGE_SIZE = 10;

function ResultLabel({ result }: { result?: string }) {
  if (result === "pass") return <span className="text-green-600">合格</span>;
  if (result === "fail") return <span className="text-red-600">不合格</span>;
  return <span className="text-gray-400">—</span>;
}

interface PageResp {
  items: SampleReceipt[];
  total: number;
}

export type StageFilter = "all" | "not_yet" | "submitted";

export interface FlowStagePageProps {
  /** 页面标题（如「报告审核」） */
  title: string;
  /** 本页面对应的流程阶段（不填则显示全部，不按阶段过滤） */
  stage?: FlowStage;
  /** 三态过滤器：有 stage 时默认 not_yet，无 stage 时默认 all */
  defaultFilter?: StageFilter;
  /** 标题右侧说明文字 */
  subtitle?: string;
  /** 标题栏右侧的自定义按钮（如「新建接样」） */
  toolbar?: (refresh: () => Promise<void>) => ReactNode;
  /** 每行「操作」列的自定义按钮（如「编辑」「录入结果」） */
  rowActions?: (r: SampleReceipt, refresh: () => Promise<void>) => ReactNode;
  /** 额外的数据列 */
  extraColumns?: { header: string; render: (r: SampleReceipt) => ReactNode }[];
  /** 提交按钮文案（默认「提交」） */
  submitLabel?: string;
  /** 是否允许提交（归档页默认关闭） */
  canSubmit?: boolean;
  /** 是否允许退回（接样页为首环节默认关闭） */
  canReturn?: boolean;
  /** 功能 ID（用于 data-fn 入口标记），格式 Mxx.Fyy.Izz */
  dataFn?: string;
  /** 三态过滤器的 data-fn ID，如 M03.F01.I06 */
  filterDataFn?: string;
  /** 行级「查看详情」按钮的 data-fn ID，如 M03.F05.I02 */
  viewDataFn?: string;
  /** 行级「提交/退回」按钮的 data-fn ID，如 M03.F05.I03（审核通过/批准/发放/归档等共用） */
  actionDataFn?: string;
  /** 下一阶段的自定义标签（用于「提交后进入」文案覆盖，如 issuance→已归档） */
  nextStageLabel?: string;
}

/** v2.0：流程阶段通用页面——
 * 接样管理 → 任务安排 → 数据录入 → 报告审核 → 报告批准 → 报告发放 → 报告归档
 * 单一流程线；前进=提交（支持批量），后退=退回（支持批量）；
 * 「我提交的（可撤回）」区块列出本人已提交至下一环节且未被处理的单据，支持批量撤回。
 */
// @entry M03.F05.I02 报告审核 查看详情按钮
// @entry M03.F05.I03 报告审核 审核通过/退回按钮
// @entry M03.F06.I02 报告批准 查看详情按钮
// @entry M03.F06.I03 报告批准 批准/退回按钮
// @entry M03.F07.I02 报告发放 查看详情按钮
// @entry M03.F07.I03 报告发放 发放/退回按钮
// @entry M03.F08.I02 报告归档 查看详情按钮
// @entry M03.F08.I03 报告归档 归档/退回按钮
export function FlowStagePage({
  title,
  stage,
  defaultFilter,
  subtitle,
  toolbar,
  rowActions,
  extraColumns = [],
  submitLabel,
  canSubmit,
  canReturn,
  dataFn,
  filterDataFn,
  viewDataFn,
  actionDataFn,
  nextStageLabel,
}: FlowStagePageProps) {
  const user = useAuthStore((s) => s.user);
  const operator = user?.id ?? user?.username ?? "anonymous";
  const navigate = useRouter();

  const stageIdx = stage ? FLOW_STAGE_ORDER.indexOf(stage) : -1;
  const nextStage = stage
    ? (FLOW_STAGE_ORDER[stageIdx + 1] as FlowStage | undefined)
    : undefined;
  const prevStage = stage
    ? (FLOW_STAGE_ORDER[stageIdx - 1] as FlowStage | undefined)
    : undefined;
  const allowSubmit = canSubmit ?? Boolean(nextStage);
  const allowReturn = canReturn ?? Boolean(prevStage);

  const [list, setList] = useState<SampleReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  // 三态过滤器：全部/未提交/已提交；接样页（无 stage）默认全部，其他页面默认未提交
  const [filter, setFilter] = useState<StageFilter>(() => {
    if (defaultFilter !== undefined) return defaultFilter;
    return stage ? "not_yet" : "all";
  });

  // 「我提交的（可撤回)」——已提交至下一环节且最近提交人为本人
  const [submittedList, setSubmittedList] = useState<SampleReceipt[]>([]);
  const [submittedSelected, setSubmittedSelected] = useState<Set<string>>(new Set());

  // 报告名称（中文简称）/ 合同编号 查找表
  const [reportNames, setReportNames] = useState<InspectionReportName[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  useEffect(() => {
    apiClient
      .get<{ items: InspectionReportName[] }>(API_ROUTES['/report-names'], { params: { page: 1, pageSize: 200 } })
      .then((r) => setReportNames(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setReportNames([]));
    apiClient
      .get<{ items: Contract[] }>(API_ROUTES['/contracts'], { params: { page: 1, pageSize: 200 } })
      .then((r) => setContracts(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setContracts([]));
  }, []);
  // 老种子数据 categoryCode 仍是 MaterialType 编码（steel/concrete/...），非 RN-xxx，
  // 查不到 report-name 时用这套中文回退，保证列显示中文简称。
  const LEGACY_CATEGORY_LABEL: Record<string, string> = {
    steel: "钢材",
    cement: "水泥",
    concrete: "混凝土",
    sand: "建设用砂",
    gravel: "碎石",
    rebar_mech: "钢筋机械连接",
    rebar_weld: "钢筋焊接接头",
  };
  const reportNameLabel = (code?: string) => {
    if (!code) return "—";
    return reportNames.find((r) => r.code === code)?.name ?? LEGACY_CATEGORY_LABEL[code] ?? code;
  };
  const contractCode = (id?: string) =>
    (id && contracts.find((c) => c.id === id)?.contractCode) || id || "—";

  const fetchStage = useCallback(
    async (p: number, kw: string) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {
          page: String(p),
          pageSize: String(PAGE_SIZE),
        };
        if (stage) params.flowStatus = stage;
        if (kw) params.keyword = kw;
        if (filter !== "all") params.filter = filter;
        const res = await apiClient.get<PageResp>(API_ROUTES['/receipts'], { params });
        setList(res.data.items);
        setTotal(res.data.total);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [stage, filter],
  );

  const fetchSubmitted = useCallback(async () => {
    if (!nextStage) {
      setSubmittedList([]);
      return;
    }
    try {
      const res = await apiClient.get<PageResp>(API_ROUTES['/receipts'], {
        params: {
          page: "1",
          pageSize: "100",
          flowStatus: nextStage,
          lastSubmittedBy: operator,
        },
      });
      setSubmittedList(res.data.items);
    } catch {
      setSubmittedList([]);
    }
  }, [nextStage, operator]);

  const refresh = useCallback(async () => {
    setSelected(new Set());
    setSubmittedSelected(new Set());
    await Promise.all([fetchStage(page, keyword), fetchSubmitted()]);
  }, [fetchStage, fetchSubmitted, page, keyword]);

  useEffect(() => {
    fetchStage(page, keyword);
    fetchSubmitted();
    setSelected(new Set());
    setSubmittedSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, stage, filter]);

  const handleSearch = () => {
    setPage(1);
    fetchStage(1, keyword);
  };

  const runFlow = async (action: FlowAction, ids: string[]) => {
    if (ids.length === 0) return;
    setProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post<{ results: FlowActionResult[] }>(
        API_ROUTES['/receipts/flow'],
        {
          action,
          ids,
          operator,
        },
      );
      const results = res.data.results;
      const failed = results.filter((r) => !r.ok);
      const okCount = results.length - failed.length;
      const actionLabel =
        action === "submit" ? "提交" : action === "return" ? "退回" : "撤回";
      if (okCount > 0) setNotice(`已${actionLabel} ${okCount} 条`);
      if (failed.length > 0) setError(failed.map((f) => f.message).join("；"));
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setProcessing(false);
    }
  };

  const toggle = (set_: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set_);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const allChecked = list.length > 0 && list.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(list.map((r) => r.id)));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const finalSubmitLabel = submitLabel ?? "提交";
  const colSpan = 11 + extraColumns.length;

  return (
    <div className="space-y-4" data-fn={dataFn}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">
            当前环节：{stage ? FLOW_STAGE_LABELS[stage] : "全部"}
            {nextStage &&
              allowSubmit &&
              ` ｜ 提交后进入：${nextStageLabel ?? FLOW_STAGE_LABELS[nextStage]}`}
            {prevStage && allowReturn && ` ｜ 退回至：${FLOW_STAGE_LABELS[prevStage]}`}
            {subtitle ? ` ｜ ${subtitle}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">{toolbar?.(refresh)}</div>
      </div>

      <div className="flex items-center gap-2 bg-white p-3 rounded shadow-sm">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as StageFilter);
            setPage(1);
          }}
          data-fn={filterDataFn}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="all">全部</option>
          <option value="not_yet">未提交</option>
          <option value="submitted">已提交</option>
        </select>
        <input
          placeholder="搜索委托书编号/报告编号/接样人"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800"
        >
          搜索
        </button>
      </div>

      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="text-green-700 text-sm bg-green-50 p-2 rounded">
          {notice}
        </div>
      )}

      {(allowSubmit || allowReturn) && (
        <div className="flex items-center gap-2 bg-white p-3 rounded shadow-sm text-sm">
          <span className="text-gray-600">已选 {selected.size} 条</span>
          {allowSubmit && (
            <button
              disabled={selected.size === 0 || processing}
              onClick={() => runFlow("submit", [...selected])}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              批量{finalSubmitLabel}
            </button>
          )}
          {allowReturn && (
            <button
              disabled={selected.size === 0 || processing}
              onClick={() => runFlow("return", [...selected])}
              className="px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
            >
              批量退回
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  aria-label="全选"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2 text-left">委托日期</th>
              <th className="px-4 py-2 text-left">报告名称</th>
              <th className="px-4 py-2 text-left">合同编号</th>
              <th className="px-4 py-2 text-left">委托书编号</th>
              <th className="px-4 py-2 text-left">报告编号</th>
              <th className="px-4 py-2 text-left">检测类别</th>
              <th className="px-4 py-2 text-left">接样人</th>
              {extraColumns.map((c) => (
                <th key={c.header} className="px-4 py-2 text-left">
                  {c.header}
                </th>
              ))}
              <th className="px-4 py-2 text-left">检测结果</th>
              <th className="px-4 py-2 text-left">状态</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && list.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-400">
                  暂无「{stage ? FLOW_STAGE_LABELS[stage] : "全部"}」环节的单据
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${r.commissionCode}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(selected, r.id, setSelected)}
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{r.commissionDate}</td>
                <td className="px-4 py-2 whitespace-nowrap">{reportNameLabel(r.categoryCode)}</td>
                <td className="px-4 py-2 whitespace-nowrap">{contractCode(r.contractId)}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.commissionCode}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.reportCode ?? "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.testCategory ?? "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.receivedBy}</td>
                {extraColumns.map((c) => (
                  <td key={c.header} className="px-4 py-2">
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <ResultLabel result={r.result} />
                </td>
                <td className="px-4 py-2">{FLOW_STAGE_LABELS[r.flowStatus]}</td>
                <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => navigate.push(`/receipts/${r.id}`)}
                    data-fn={viewDataFn}
                    className="px-2 py-1 text-gray-600 hover:underline"
                  >
                    查看详情
                  </button>
                  {rowActions?.(r, refresh)}
                  {allowSubmit && (
                    <button
                      disabled={processing}
                      onClick={() => runFlow("submit", [r.id])}
                      data-fn={actionDataFn}
                      className="px-2 py-1 text-blue-600 hover:underline"
                    >
                      {finalSubmitLabel}
                    </button>
                  )}
                  {allowReturn && (
                    <button
                      disabled={processing}
                      onClick={() => runFlow("return", [r.id])}
                      className="px-2 py-1 text-orange-600 hover:underline"
                    >
                      退回
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共 {total} 条</span>
        <div className="space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>

      {nextStage && (
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div>
              <span className="text-sm font-semibold text-gray-700">
                我提交的（可撤回）
              </span>
              <span className="text-xs text-gray-500 ml-2">
                已提交至「{FLOW_STAGE_LABELS[nextStage]}
                」且未被处理的单据，可由提交人主动撤回
              </span>
            </div>
            <button
              disabled={submittedSelected.size === 0 || processing}
              onClick={() => runFlow("withdraw", [...submittedSelected])}
              className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              批量撤回（{submittedSelected.size}）
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {submittedList.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-400">
                    暂无可撤回的单据
                  </td>
                </tr>
              )}
              {submittedList.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      aria-label={`选择可撤回 ${r.commissionCode}`}
                      checked={submittedSelected.has(r.id)}
                      onChange={() =>
                        toggle(submittedSelected, r.id, setSubmittedSelected)
                      }
                    />
                  </td>
                  <td className="px-4 py-2">{r.commissionCode}</td>
                  <td className="px-4 py-2">{r.reportCode ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    当前：{FLOW_STAGE_LABELS[r.flowStatus]}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={processing}
                      onClick={() => runFlow("withdraw", [r.id])}
                      className="px-2 py-1 text-gray-600 hover:underline"
                    >
                      撤回
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FlowStagePage;
