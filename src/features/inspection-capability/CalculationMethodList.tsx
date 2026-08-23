"use client";
import { useEffect, useState } from "react";
// REF src/features/inspection-capability/CalculationMethodList.tsx 移植。
// 差异：apiClient → @/api/legacy-client + API_ROUTES。msw 计算方法主键是
// (inspectionObjectCode, inspectionParameterCode) 复合键而非 id——组件内的
// PUT/DELETE 走 tests 端 shape adapter 兜底（键语义不变，REF 行为保持）。
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  TwoLevelObjectStandardTree,
  type TreeListItem,
} from "./TwoLevelObjectStandardTree";

interface CalcRow extends TreeListItem {
  id: string;
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  testingStandardCode?: string;
  objectName?: string;
  parameterName?: string;
  algorithmType: string;
  specimenCount: number;
  remark?: string;
}

interface Opt {
  code: string;
  name: string;
}

const ALGORITHMS = [
  "simple_avg",
  "compressive_strength",
  "flexural_strength",
  "steel_tensile",
  "formula",
  "manual",
];
const emptyForm = {
  inspectionObjectCode: "",
  inspectionParameterCode: "",
  testingStandardCode: "",
  algorithmType: "manual",
  specimenCount: "1",
  remark: "",
};

export function CalculationMethodList() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [objects, setObjects] = useState<Opt[]>([]);
  const [params, setParams] = useState<Opt[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null);

  // 跟踪当前选中的检测标准（树组件用内部状态，这里提升上来让保存/删除后能刷新）
  useEffect(() => {
    apiClient
      .get<{ items: Opt[] }>(API_ROUTES["/inspection-objects"], {
        params: { page: 1, pageSize: "1000" },
      })
      .then((r) => setObjects(r.data?.items ?? []))
      .catch(() => {});
    apiClient
      .get<{ items: Opt[] }>(API_ROUTES["/inspection-parameters"], {
        params: { page: 1, pageSize: "1000" },
      })
      .then((r) => setParams(r.data?.items ?? []))
      .catch(() => {});
  }, []);

  const reloadList = (standardCode: string) => {
    // 触发树组件 useEffect 重拉：先 null 再设回原值
    setSelectedStandard(null);
    setTimeout(() => setSelectedStandard(standardCode), 0);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, testingStandardCode: selectedStandard ?? "" });
    setError(null);
    setOpen(true);
  };

  const openEdit = (row: CalcRow) => {
    setEditId(row.id);
    setForm({
      inspectionObjectCode: row.inspectionObjectCode,
      inspectionParameterCode: row.inspectionParameterCode,
      testingStandardCode: row.testingStandardCode ?? "",
      algorithmType: row.algorithmType,
      specimenCount: String(row.specimenCount ?? 1),
      remark: row.remark ?? "",
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setError(null);
    const payload = {
      inspectionObjectCode: form.inspectionObjectCode,
      inspectionParameterCode: form.inspectionParameterCode,
      testingStandardCode: form.testingStandardCode || undefined,
      algorithmType: form.algorithmType,
      specimenCount: Number(form.specimenCount) || 1,
      remark: form.remark || undefined,
    };
    try {
      if (editId)
        await apiClient.put(
          `${API_ROUTES["/inspection-calculation-methods"]}/${editId}`,
          payload,
        );
      else await apiClient.post(API_ROUTES["/inspection-calculation-methods"], payload);
      setOpen(false);
      if (selectedStandard) reloadList(selectedStandard);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "保存失败",
      );
    }
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除？")) return;
    await apiClient.delete(`${API_ROUTES["/inspection-calculation-methods"]}/${id}`);
    if (selectedStandard) reloadList(selectedStandard);
  };

  const buildPutBody = (_item: CalcRow, sortOrder: number) => ({ sortOrder });

  return (
    <div data-fn="M06.F05.I01" className="flex flex-col flex-1 min-h-0">
      {/* @entry M06.F05.I02 计算方法新建/编辑按钮（TwoLevelObjectStandardTree 内"新建"+"编辑"） */}
      {/* @entry M06.F05.I03 计算方法删除按钮（TwoLevelObjectStandardTree 内行"删除"） */}
      <TwoLevelObjectStandardTree<CalcRow>
        title="计算方法"
        dataFn="M06.F05.I01"
        listEndpoint="/inspection-calculation-methods"
        listFilterParam="testingStandardCode"
        createDataFn="M06.F05.I02"
        editDataFn="M06.F05.I02"
        deleteDataFn="M06.F05.I03"
        sortBy={["inspectionParameterCode", "spec", "model", "brand", "grade"]}
        getItemId={(it) => it.id}
        columns={[
          {
            key: "inspectionParameterCode",
            label: "检测参数",
            width: "w-32",
            render: (it) => it.parameterName ?? it.inspectionParameterCode,
          },
          { key: "spec", label: "规格", width: "w-24" },
          { key: "model", label: "型号", width: "w-20" },
          { key: "brand", label: "牌号", width: "w-24" },
          { key: "grade", label: "等级", width: "w-16" },
          { key: "algorithmType", label: "判定方式", width: "w-28", align: "center" },
          {
            key: "specimenCount",
            label: "上限",
            width: "w-16",
            align: "right",
            render: (it) => "×" + it.specimenCount,
          },
          { key: "remark", label: "下限", width: "w-24" },
        ]}
        buildPutBody={buildPutBody}
        selectedStandard={selectedStandard}
        onSelectedStandardChange={setSelectedStandard}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={(it) => remove(it.id)}
      />

      <ConfirmModal
        open={open}
        title={editId ? "编辑计算方法" : "新建计算方法"}
        message={
          <div className="space-y-3 text-left text-sm">
            {error && (
              <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
            <label className="block">
              <span className="text-xs text-gray-600">检测项目</span>
              <select
                aria-label="检测项目"
                value={form.inspectionObjectCode}
                onChange={(e) =>
                  setForm({ ...form, inspectionObjectCode: e.target.value })
                }
                className="mt-1 w-full border rounded px-2 py-1.5"
              >
                <option value="">选择检测项目</option>
                {objects.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">检测参数</span>
              <select
                aria-label="检测参数"
                value={form.inspectionParameterCode}
                onChange={(e) =>
                  setForm({ ...form, inspectionParameterCode: e.target.value })
                }
                className="mt-1 w-full border rounded px-2 py-1.5"
              >
                <option value="">选择检测参数</option>
                {params.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">检测标准</span>
              <input
                aria-label="检测标准"
                value={form.testingStandardCode}
                onChange={(e) =>
                  setForm({ ...form, testingStandardCode: e.target.value })
                }
                className="mt-1 w-full border rounded px-2 py-1.5 font-mono"
                placeholder="如 GB/T 228.1-2021"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">算法类型</span>
              <select
                aria-label="算法类型"
                value={form.algorithmType}
                onChange={(e) => setForm({ ...form, algorithmType: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1.5"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">试件数量</span>
              <input
                aria-label="试件数量"
                type="number"
                value={form.specimenCount}
                onChange={(e) => setForm({ ...form, specimenCount: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">备注</span>
              <input
                aria-label="备注"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1.5"
              />
            </label>
          </div>
        }
        confirmText="保存"
        loading={false}
        onConfirm={save}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export default CalculationMethodList;
