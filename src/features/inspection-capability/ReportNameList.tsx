"use client";
import { useEffect, useState } from "react";
// REF src/features/inspection-capability/ReportNameList.tsx 移植。
// 差异：apiClient → @/api/legacy-client + API_ROUTES（junction 端点映射到
// /api/report-names/links/*）；ExtFieldDef 从 @/types/common 取。
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { AssociationManager } from "./AssociationManager";
import type { ExtFieldDef } from "@/types/common/ext-field-def";

interface ReportName {
  id: string;
  code: string;
  name: string;
  fullName?: string;
  templatePath?: string;
  description?: string;
  extFields?: ExtFieldDef[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportNameStandardLink {
  reportNameCode: string;
  inspectionStandardCode: string;
  role: "TESTING" | "JUDGMENT";
}
interface ReportNameParameterLink {
  reportNameCode: string;
  inspectionParameterCode: string;
}
interface InspectionParameter {
  code: string;
  name: string;
}

const PAGE_SIZE = 50;
/** 拉全量关联用的大页（当前量级：557 标准 / 1836 参数 / 1133 参数主表）。 */
const BIG_PAGE = "10000";

type TabKey = "basic" | "objects" | "standards" | "parameters" | "extFields";

const emptyForm = {
  code: "",
  name: "",
  fullName: "",
  templatePath: "",
  description: "",
  sortOrder: "0",
};

const TAB_LABELS: Record<TabKey, string> = {
  basic: "基础信息",
  objects: "关联检测项目",
  standards: "关联检测标准",
  parameters: "关联检测参数",
  extFields: "扩展属性",
};

const TAB_ORDER: TabKey[] = ["basic", "objects", "standards", "parameters", "extFields"];

/** 聚合单元格：逗号分隔展示，超过 LIMIT 条截断为 "+N"，完整清单放 title。 */
const AGG_LIMIT = 5;
function AggregateList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) return <span className="text-gray-400">{emptyText}</span>;
  const shown = items.slice(0, AGG_LIMIT);
  const rest = items.length - shown.length;
  const text = rest > 0 ? `${shown.join("、")} 等 ${items.length} 项` : shown.join("、");
  return (
    <span title={items.join("、")} className="block max-w-md truncate">
      {text}
    </span>
  );
}

export function ReportNameList() {
  const [rows, setRows] = useState<ReportName[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null); // 用于关联页签
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [extFields, setExtFields] = useState<ExtFieldDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 聚合列数据：报告名称 → 标准编码集 / 参数编码集，以及参数编码→名称
  const [stdByRn, setStdByRn] = useState<Record<string, string[]>>({});
  const [paramByRn, setParamByRn] = useState<Record<string, string[]>>({});
  const [paramNameByCode, setParamNameByCode] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    apiClient
      .get<{ items: ReportName[]; total: number }>(API_ROUTES["/report-names"], {
        params: { page, pageSize: String(PAGE_SIZE) },
      })
      .then((res) => {
        setRows(Array.isArray(res.data?.items) ? res.data.items : []);
        setTotal(typeof res.data?.total === "number" ? res.data.total : 0);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const loadAssociations = () => {
    Promise.all([
      apiClient.get<{ items: ReportNameStandardLink[] }>(
        API_ROUTES["/inspection-report-name-standards"],
        {
          params: { pageSize: BIG_PAGE },
        },
      ),
      apiClient.get<{ items: ReportNameParameterLink[] }>(
        API_ROUTES["/inspection-report-name-parameters"],
        {
          params: { pageSize: BIG_PAGE },
        },
      ),
      apiClient.get<{ items: InspectionParameter[] }>(API_ROUTES["/inspection-parameters"], {
        params: { pageSize: BIG_PAGE },
      }),
    ]).then(([stdRes, paramRes, paramMasterRes]) => {
      const stdMap: Record<string, string[]> = {};
      for (const link of stdRes.data?.items ?? []) {
        const arr = stdMap[link.reportNameCode] ?? [];
        if (link.inspectionStandardCode && !arr.includes(link.inspectionStandardCode))
          arr.push(link.inspectionStandardCode);
        stdMap[link.reportNameCode ?? ''] = arr;
      }
      for (const k of Object.keys(stdMap)) stdMap[k]!.sort();
      setStdByRn(stdMap);

      const paramMap: Record<string, string[]> = {};
      for (const link of paramRes.data?.items ?? []) {
        const arr = paramMap[link.reportNameCode] ?? [];
        if (!arr.includes(link.inspectionParameterCode))
          arr.push(link.inspectionParameterCode);
        paramMap[link.reportNameCode] = arr;
      }
      setParamByRn(paramMap);

      const nameMap: Record<string, string> = {};
      for (const p of paramMasterRes.data?.items ?? []) nameMap[p.code] = p.name;
      setParamNameByCode(nameMap);
    });
  };
  useEffect(loadAssociations, []);

  const openCreate = () => {
    setEditId(null);
    setSavedCode(null);
    setForm(emptyForm);
    setExtFields([]);
    setActiveTab("basic");
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (row: ReportName) => {
    setEditId(row.id);
    setSavedCode(row.code);
    setForm({
      code: row.code,
      name: row.name,
      fullName: row.fullName ?? "",
      templatePath: row.templatePath ?? "",
      description: row.description ?? "",
      sortOrder: String(row.sortOrder ?? 0),
    });
    setExtFields(Array.isArray(row.extFields) ? row.extFields : []);
    setActiveTab("basic");
    setError(null);
    setFormOpen(true);
  };

  const save = async () => {
    setError(null);
    const payload = {
      code: form.code,
      name: form.name,
      fullName: form.fullName || undefined,
      templatePath: form.templatePath || undefined,
      description: form.description || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      extFields: extFields,
    };
    try {
      if (editId) {
        await apiClient.put(`${API_ROUTES["/report-names"]}/${editId}`, payload);
      } else {
        await apiClient.post(API_ROUTES["/report-names"], payload);
      }
      // 首次保存后允许跳转关联页签
      setSavedCode(form.code || null);
      setEditId(form.code || null);
      load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "保存失败",
      );
    }
  };

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`${API_ROUTES["/report-names"]}/${id}`);
      load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "删除失败",
      );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canAssociate = !!savedCode;

  const closeForm = () => {
    setFormOpen(false);
    // 关联可能在弹窗页签里被改过，刷新聚合列
    loadAssociations();
  };

  return (
    <div className="space-y-4" data-fn="M06.F07.I01">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">报告名称</h2>
        <button
          type="button"
          onClick={openCreate}
          data-fn="M06.F07.I02"
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新建报告名称
        </button>
      </header>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">编码</th>
              <th className="px-4 py-2 text-left">简称</th>
              <th className="px-4 py-2 text-left">检测标准</th>
              <th className="px-4 py-2 text-left">检测参数</th>
              <th className="px-4 py-2 text-left">扩展属性</th>
              <th className="px-4 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const stds = stdByRn[r.code] ?? [];
              const params = (paramByRn[r.code] ?? []).map(
                (c) => paramNameByCode[c] ?? c,
              );
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    <AggregateList items={stds} emptyText="-" />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    <AggregateList items={params} emptyText="-" />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    <AggregateList
                      items={(r.extFields ?? []).map((f) => `${f.key}(${f.label})`)}
                      emptyText="-"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      data-fn="M06.F07.I02"
                      aria-label={`编辑 ${r.id}`}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      data-fn="M06.F07.I03"
                      aria-label={`删除 ${r.id}`}
                      className="text-red-600 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共 {total} 条</span>
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
            第 {page} / {totalPages} 页
          </span>
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editId ? `编辑报告名称 — ${savedCode}` : "新建报告名称"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-700 text-xl"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            {/* 页签 */}
            <div role="tablist" className="flex border-b text-sm">
              {TAB_ORDER.map((k) => {
                const disabled = k !== "basic" && !canAssociate;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === k}
                    aria-controls={`tab-panel-${k}`}
                    disabled={disabled}
                    onClick={() => !disabled && setActiveTab(k)}
                    // @entry M06.F07.I07 报告名称-检测参数关联（编辑弹窗的「关联检测参数」页签）
                    data-fn={
                      k === "basic"
                        ? "M06.F07.I02"
                        : k === "objects"
                          ? "M06.F07.I04"
                          : k === "standards"
                            ? "M06.F07.I05"
                            : k === "parameters"
                              ? "M06.F07.I07"
                              : "M06.F07.I08"
                    }
                    className={`px-3 py-1.5 -mb-px border-b-2 ${activeTab === k ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-gray-500"} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:text-blue-600"}`}
                  >
                    {TAB_LABELS[k]}
                  </button>
                );
              })}
            </div>

            {error && (
              <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {activeTab === "basic" && (
              <div id="tab-panel-basic" role="tabpanel" className="space-y-3">
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">编码</span>
                  <input
                    aria-label="编码"
                    value={form.code}
                    disabled={!!editId}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">简称（主显示名）</span>
                  <input
                    aria-label="简称"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">全称（可选）</span>
                  <input
                    aria-label="全称"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">模板路径（可选）</span>
                  <input
                    aria-label="模板路径"
                    value={form.templatePath}
                    onChange={(e) => setForm({ ...form, templatePath: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5 font-mono text-xs"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">描述（可选）</span>
                  <input
                    aria-label="描述"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">排序</span>
                  <input
                    aria-label="排序"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1.5"
                  />
                </label>
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}

            {activeTab === "objects" && savedCode && (
              <div id="tab-panel-objects" role="tabpanel" className="space-y-3">
                <AssociationManager
                  ariaLabel={`${savedCode} 关联检测项目`}
                  endpoint="/inspection-object-report-names"
                  parentParam="reportNameCode"
                  parentCode={savedCode}
                  targetLabel="检测项目"
                  targetEndpoint="/inspection-objects"
                  targetParam="inspectionObjectCode"
                  targetValueKey="code"
                  targetTextKey="name"
                  fnId="M06.F07.I04"
                />
              </div>
            )}

            {activeTab === "standards" && savedCode && (
              <div id="tab-panel-standards" role="tabpanel" className="space-y-3">
                <p className="text-xs text-gray-500">
                  role 字段区分检测依据 / 判定依据；同一 (报告名称, 标准) 可同时存两条不同
                  role 的记录。
                </p>
                <AssociationManager
                  ariaLabel={`${savedCode} 关联检测标准`}
                  endpoint="/inspection-report-name-standards"
                  parentParam="reportNameCode"
                  parentCode={savedCode}
                  targetLabel="检测标准"
                  targetEndpoint="/inspection-standards"
                  targetParam="inspectionStandardCode"
                  targetValueKey="code"
                  targetTextKey="code"
                  targetExtraTextKey="name"
                  extraFields={[
                    {
                      name: "role",
                      label: "角色",
                      type: "select",
                      options: ["TESTING", "JUDGMENT"],
                      valueLabels: { TESTING: "检测依据", JUDGMENT: "判定依据" },
                      rowPrefix: { TESTING: "【检测依据】", JUDGMENT: "【判定依据】" },
                    },
                  ]}
                  fnId="M06.F07.I05"
                />
              </div>
            )}

            {activeTab === "parameters" && savedCode && (
              <div id="tab-panel-parameters" role="tabpanel" className="space-y-3">
                <AssociationManager
                  ariaLabel={`${savedCode} 关联检测参数`}
                  endpoint="/inspection-report-name-parameters"
                  parentParam="reportNameCode"
                  parentCode={savedCode}
                  targetLabel="检测参数"
                  targetEndpoint="/inspection-parameters"
                  targetParam="inspectionParameterCode"
                  targetValueKey="code"
                  targetTextKey="name"
                  prefilter={{
                    label: "检测项目",
                    endpoint: "/inspection-objects",
                    valueKey: "code",
                    textKey: "name",
                    filterEndpoint: "/inspection-object-parameters",
                    filterParamKey: "inspectionObjectCode",
                    filterResultKey: "inspectionParameterCode",
                  }}
                  showParameterObjects
                  fnId="M06.F07.I07"
                />
              </div>
            )}

            {activeTab === "extFields" && savedCode && (
              <div id="tab-panel-extFields" role="tabpanel" className="space-y-3">
                <p className="text-xs text-gray-500">
                  报告预览前，若当前样品的 ext 未覆盖下列 key，会自动弹出
                  <code className="font-mono mx-1">SampleExtFieldsModal</code>
                  让用户补录。详见 docs/conventions/report-template-extfields.md。
                </p>
                <table className="w-full text-xs border rounded overflow-hidden">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left">key *</th>
                      <th className="px-2 py-1.5 text-left">label *</th>
                      <th className="px-2 py-1.5 text-left">type</th>
                      <th className="px-2 py-1.5 text-left">tag</th>
                      <th className="px-2 py-1.5 text-left">必填</th>
                      <th className="px-2 py-1.5 text-left">source</th>
                      <th className="px-2 py-1.5 text-left">options (·分隔)</th>
                      <th className="px-2 py-1.5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extFields.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-2 py-3 text-center text-gray-400">
                          暂无扩展属性，点下方按钮新增。
                        </td>
                      </tr>
                    )}
                    {extFields.map((f, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="px-2 py-1.5">
                          <input
                            aria-label={`extFields[${i}].key`}
                            value={f.key}
                            onChange={(e) => {
                              const next = [...extFields];
                              next[i] = { ...f, key: e.target.value };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5 font-mono"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            aria-label={`extFields[${i}].label`}
                            value={f.label}
                            onChange={(e) => {
                              const next = [...extFields];
                              next[i] = { ...f, label: e.target.value };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            aria-label={`extFields[${i}].type`}
                            value={f.type ?? "text"}
                            onChange={(e) => {
                              const next = [...extFields];
                              const t = e.target.value as ExtFieldDef["type"];
                              next[i] = {
                                ...f,
                                type: t,
                                options: t === "select" ? (f.options ?? []) : undefined,
                              };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5"
                          >
                            <option value="text">text</option>
                            <option value="number">number</option>
                            <option value="date">date</option>
                            <option value="select">select</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            aria-label={`extFields[${i}].tag`}
                            value={f.tag ?? ""}
                            placeholder={f.key || "(同 key)"}
                            onChange={(e) => {
                              const next = [...extFields];
                              next[i] = { ...f, tag: e.target.value || undefined };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5 font-mono"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            aria-label={`extFields[${i}].required`}
                            type="checkbox"
                            checked={f.required ?? false}
                            onChange={(e) => {
                              const next = [...extFields];
                              next[i] = { ...f, required: e.target.checked };
                              setExtFields(next);
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            aria-label={`extFields[${i}].source`}
                            value={f.source ?? "sample"}
                            onChange={(e) => {
                              const next = [...extFields];
                              next[i] = {
                                ...f,
                                source: e.target.value as ExtFieldDef["source"],
                              };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5"
                          >
                            <option value="sample">sample</option>
                            <option value="receipt">receipt</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            aria-label={`extFields[${i}].options`}
                            value={(f.options ?? []).join("·")}
                            placeholder="仅 type=select 用"
                            disabled={(f.type ?? "text") !== "select"}
                            onChange={(e) => {
                              const next = [...extFields];
                              const arr = e.target.value
                                .split("·")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              next[i] = { ...f, options: arr };
                              setExtFields(next);
                            }}
                            className="w-full border rounded px-1 py-0.5 disabled:bg-gray-100"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            aria-label={`删除 ${f.key || i}`}
                            onClick={() =>
                              setExtFields(extFields.filter((_, j) => j !== i))
                            }
                            className="text-red-600 hover:underline"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExtFields([
                        ...extFields,
                        {
                          key: "",
                          label: "",
                          type: "text",
                          source: "sample",
                        } as ExtFieldDef,
                      ])
                    }
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    + 新增
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                    >
                      关闭
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab !== "basic" && activeTab !== "extFields" && !savedCode && (
              <div className="text-sm text-gray-400 py-8 text-center">
                请先在「基础信息」页签保存后再设置关联。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportNameList;
