// M05.F01.I01 汇总表 + M05.F01.I02 仪表盘容器（含 I03 核心指标 + I04 任务漏斗）
//
// 数据源：
//   GET /api/report-names           报告名称下拉选项
//   GET /api/summary?categoryCode=   汇总表数据
//   GET /api/summary/stats          仪表盘核心指标 + 任务漏斗
//
// UI 顺序：仪表盘容器(I02) → 核心指标(I03) → 任务漏斗(I04) → 报告类别筛选 + 汇总表(I01)
import { useEffect, useState } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import type { SummaryColumn, SummaryData } from "@/types/process/summary";
import type { InspectionReportName } from "@/types/inspection/inspection-report-name";

// ——— stats 端点形状 ———
interface StatsResponse {
  todayTestCount: number;
  qualifiedRateByMaterial: {
    concrete: { total: number; pass: number; rate: number };
    rebar: { total: number; pass: number; rate: number };
    sand: { total: number; pass: number; rate: number };
  };
  reportOutputByStatus: {
    generated: number;
    pending: number;
    issued: number;
  };
  funnelByStage: {
    pending_collect: number;
    received: number;
    testing: number;
    reporting: number;
    reviewing: number;
    issued: number;
  };
}

const FUNNEL_LABELS: Array<{ key: keyof StatsResponse["funnelByStage"]; label: string }> = [
  { key: "pending_collect", label: "待取样" },
  { key: "received", label: "已收样" },
  { key: "testing", label: "试验中" },
  { key: "reporting", label: "报告编制" },
  { key: "reviewing", label: "待审核" },
  { key: "issued", label: "已签发" },
];

const MATERIAL_LABELS: Array<{
  key: keyof StatsResponse["qualifiedRateByMaterial"];
  label: string;
}> = [
  { key: "concrete", label: "混凝土" },
  { key: "rebar", label: "钢筋" },
  { key: "sand", label: "砂石" },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

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
  const [stats, setStats] = useState<StatsResponse | null>(null);
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

  // 拉仪表盘 stats（一次性）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(API_ROUTES["/summary/stats"]);
        if (!cancelled) setStats(res.data as StatsResponse);
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
    // @entry M05.F01.I02 — 仪表盘容器（包裹 I03/I04 + 汇总表）
    <div className="space-y-6" data-fn="M05.F01.I02">
      {/* —— M05.F01.I03 核心指标卡 —— */}
      <section data-fn="M05.F01.I03" data-testid="dashboard-metrics" className="space-y-3">
        <h2 className="text-base font-semibold">核心指标</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            testid="metric-today-tests"
            label="今日试验总数"
            value={stats?.todayTestCount ?? "—"}
            unit="项"
          />
          <MetricCard
            testid="metric-output"
            label="报告产出量"
            customValue={
              stats ? (
                <div className="text-sm" data-testid="metric-output-detail">
                  <div>已生成：<b>{stats.reportOutputByStatus.generated}</b></div>
                  <div>待审核：<b>{stats.reportOutputByStatus.pending}</b></div>
                  <div>已签发：<b>{stats.reportOutputByStatus.issued}</b></div>
                </div>
              ) : (
                "—"
              )
            }
          />
          <MetricCard
            testid="metric-qualified-rate"
            label="检测合格率"
            customValue={
              stats ? (
                <ul className="text-sm space-y-1" data-testid="metric-qualified-detail">
                  {MATERIAL_LABELS.map((m) => {
                    const e = stats.qualifiedRateByMaterial[m.key];
                    return (
                      <li key={m.key}>
                        {m.label}：<b>{pct(e.rate)}</b>
                        <span className="text-xs text-slate-500 ml-1">
                          ({e.pass}/{e.total})
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                "—"
              )
            }
          />
        </div>
      </section>

      {/* —— M05.F01.I04 任务状态漏斗 —— */}
      <section data-fn="M05.F01.I04" data-testid="dashboard-funnel" className="space-y-3">
        <h2 className="text-base font-semibold">试验任务状态</h2>
        {stats ? (
          <FunnelChart counts={stats.funnelByStage} />
        ) : (
          <div className="text-sm text-slate-500">载入中…</div>
        )}
      </section>

      {/* —— M05.F01.I01 汇总表 —— */}
      <section data-fn="M05.F01.I01" data-testid="summary-table-section" className="space-y-3">
        <h2 className="text-base font-semibold">试验报告汇总表</h2>
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
      </section>
    </div>
  );
}

// ——— MetricCard 子组件 ———
function MetricCard({
  label,
  value,
  unit,
  customValue,
  testid,
}: {
  label: string;
  value?: string | number;
  unit?: string;
  customValue?: React.ReactNode;
  testid: string;
}) {
  return (
    <div
      data-testid={testid}
      className="border rounded bg-white p-4 shadow-sm"
    >
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="mt-2">
        {customValue ?? (
          <span className="text-2xl font-semibold tabular-nums">
            {value}
            {unit ? <span className="text-sm text-slate-500 ml-1">{unit}</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}

// ——— FunnelChart 子组件（水平条形 + 累计计数）———
function FunnelChart({ counts }: { counts: StatsResponse["funnelByStage"] }) {
  const total = FUNNEL_LABELS.reduce((acc, s) => acc + counts[s.key], 0);
  if (total === 0) {
    return (
      <div
        data-testid="funnel-empty"
        className="text-sm text-slate-500 border rounded p-4 bg-white"
      >
        当前无任务
      </div>
    );
  }
  // 漏斗视觉：按段比例画水平条，宽度逐段递减
  const stageCount = FUNNEL_LABELS.length;
  return (
    <div
      data-testid="funnel-bars"
      className="border rounded bg-white p-4 space-y-2"
    >
      {FUNNEL_LABELS.map((s, i) => {
        const count = counts[s.key];
        // 漏斗宽度：从 100% 线性递减到 50%（视觉漏斗感）
        const widthPct = 100 - (i * 50) / (stageCount - 1);
        const ratio = count / total;
        return (
          <div
            key={s.key}
            data-testid={`funnel-stage-${s.key}`}
            className="flex items-center gap-3"
          >
            <div className="w-20 text-xs text-slate-600 shrink-0">{s.label}</div>
            <div className="flex-1 h-7 bg-slate-100 rounded relative overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(ratio * widthPct).toFixed(2)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs tabular-nums">
                {count} 项
              </div>
            </div>
          </div>
        );
      })}
      <div className="text-xs text-slate-500 pt-1">
        合计 {total} 项
      </div>
    </div>
  );
}