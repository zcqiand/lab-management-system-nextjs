// M05.F01.I01 — 试验报告汇总表
//
// UI: 顶部选择报告类别（InspectionReportName.code）→ 调 /api/summary?categoryCode=<code>
//     → 渲染 backend 返回的 columns + rows（M05.F01.I02 汇总类型 已废弃，单一列表形态）
//
// 数据源：
//   /api/inspection-report-names         — 报告名称下拉选项
//   /api/summary?categoryCode=<code|ALL> — 汇总表数据
import { useEffect, useState } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import type { SummaryColumn, SummaryData } from "@/types/process/summary";
import type { InspectionReportName } from "@/types/inspection/inspection-report-name";

function pickItems(body: unknown): InspectionReportName[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && "items" in body && Array.isArray((body as { items: unknown }).items)) {
    return (body as { items: InspectionReportName[] }).items;
  }
  return [];
}

export function SummaryPage() {
  const [reportNames, setReportNames] = useState<InspectionReportName[]>([]);
  const [categoryCode, setCategoryCode] = useState<string>("ALL");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 拉报告名称下拉（一次性）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(API_ROUTES["/report-names"]);
        if (!cancelled) setReportNames(pickItems(res.data));
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 拉汇总表（categoryCode 变化时）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const url = `${API_ROUTES["/summary"]}?categoryCode=${encodeURIComponent(categoryCode)}`;
        const res = await apiClient.get(url);
        if (!cancelled) setData(res.data as SummaryData);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryCode]);

  return (
    <div className="space-y-4" data-fn="M05.F01.I01">
      <div className="flex items-center gap-3">
        <label htmlFor="summary-category" className="text-sm font-medium">
          报告类别
        </label>
        <select
          id="summary-category"
          data-testid="summary-category-select"
          className="border rounded px-2 py-1 text-sm bg-white"
          value={categoryCode}
          onChange={(e) => setCategoryCode(e.target.value)}
        >
          <option value="ALL">全部（汇总）</option>
          {reportNames.map((rn) => (
            <option key={rn.code} value={rn.code}>
              {rn.code} — {rn.name}
              {rn.summaryName ? `（${rn.summaryName}）` : ""}
            </option>
          ))}
        </select>
        {loading ? <span className="text-xs text-slate-500">载入中…</span> : null}
      </div>

      {error ? (
        <div className="text-sm text-red-600 border border-red-300 bg-red-50 rounded p-2">
          错误：{error}
        </div>
      ) : null}

      {data ? (
        <div className="border rounded bg-white overflow-x-auto">
          <div className="px-3 py-2 text-sm font-medium border-b bg-slate-50">
            {data.summaryName || "试验报告汇总表"}
            <span className="ml-2 text-xs text-slate-500">
              （{data.rows.length} 行）
            </span>
          </div>
          <table className="w-full text-sm" data-testid="summary-table">
            <thead>
              <tr>
                {data.columns.map((c: SummaryColumn) => (
                  <th
                    key={c.key}
                    className="text-left px-2 py-1 border-b font-medium"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.columns.length}
                    className="text-center text-slate-500 px-2 py-4"
                  >
                    无数据
                  </td>
                </tr>
              ) : (
                data.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    {data.columns.map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        {row[c.key] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}