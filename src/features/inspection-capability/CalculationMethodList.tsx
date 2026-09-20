"use client";
import { useEffect, useState } from "react";
// REF src/features/inspection-capability/CalculationMethodList.tsx 移植。
// TSOT Phase C2：legacy apiClient/API_ROUTES 全部替换为 orval 生成函数。
// 计算方法主键是 (inspectionObjectCode, inspectionParameterCode) 复合键而非 id：
// PUT/DELETE 走契约复合键端点（行内含原始字段，不反解 derived id）。
import {
  calculationMethodsCreateCalculationMethod,
  calculationMethodsDeleteCalculationMethod,
  calculationMethodsListCalculationMethods,
  calculationMethodsUpdateCalculationMethod,
} from "@/api/endpoints/calculation-methods/calculation-methods";
import {
  inspectionDictionaryListObjects,
  inspectionDictionaryListParameters,
} from "@/api/endpoints/inspection-dictionary/inspection-dictionary";
import type {
  CalculationMethod,
  CalculationMethodsListCalculationMethodsParams,
  CreateCalculationMethodRequest,
  UpdateCalculationMethodRequest,
} from "@/api/endpoints/model";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  TwoLevelObjectStandardTree,
  type TreeListItem,
} from "./TwoLevelObjectStandardTree";

/** 行结构 = 契约 CalculationMethod + 后端列表补列的 derived id（cr-<obj>-<param>，
 *  仅作 React key/拖拽 id 用，不再用于寻址）。 */
interface CalcRow extends CalculationMethod, TreeListItem {
  id: string;
  parameterName?: string;
  // 契约 CalculationMethod.sortOrder 必填 vs TreeListItem.sortOrder 可选，
  // 双继承冲突以契约必填侧显式重申收窄
  sortOrder: number;
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
  // 编辑中的原始行：PUT 复合键寻址用行内 inspectionObjectCode/ParameterCode，
  // 不再持有 derived id。
  const [editRow, setEditRow] = useState<CalcRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [objects, setObjects] = useState<Opt[]>([]);
  const [params, setParams] = useState<Opt[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);

  // 跟踪当前选中的检测标准（树组件用内部状态，这里提升上来让保存/删除后能刷新）
  useEffect(() => {
    inspectionDictionaryListObjects({ page: 1, pageSize: 1000 })
      .then((r) => setObjects((r.items ?? []) as Opt[]))
      .catch(() => {});
    inspectionDictionaryListParameters({ page: 1, pageSize: 1000 })
      .then((r) => setParams((r.items ?? []) as Opt[]))
      .catch(() => {});
  }, []);

  const reloadList = () => {
    // 列表数据版本号：增删改后 +1 强制树 refetch。不能走「null→setTimeout 设回原值」——
    // 批量更新下 React Object.is bailout 吞掉终值相等的状态变化，零重渲染零 refetch
    //（2026-09-13 e2e 三端一致性实测抓出）
    setListVersion((v) => v + 1);
  };

  const openCreate = () => {
    setEditRow(null);
    setForm({ ...emptyForm, testingStandardCode: selectedStandard ?? "" });
    setError(null);
    setOpen(true);
  };

  const openEdit = (row: CalcRow) => {
    setEditRow(row);
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
    // 新建路径复合键两段必填（PUT 路径键取自 editRow 行内原值，不经 form）
    const objectCode = form.inspectionObjectCode ?? "";
    const paramCode = form.inspectionParameterCode ?? "";
    if (!editRow && (!objectCode || !paramCode)) {
      setError("检测项目与检测参数为必填");
      return;
    }
    try {
      if (editRow) {
        // 契约 UpdateCalculationMethodRequest 不含复合键字段（键在 path 上），
        // 检测项目/检测参数两个下拉在编辑态语义上不可改（后端按原键定位）。
        const payload: UpdateCalculationMethodRequest = {
          testingStandardCode: form.testingStandardCode || undefined,
          algorithmType: (form.algorithmType ||
            "manual") as UpdateCalculationMethodRequest["algorithmType"],
          specimenCount: Number(form.specimenCount) || 1,
          remark: form.remark || undefined,
        };
        await calculationMethodsUpdateCalculationMethod(
          editRow.inspectionObjectCode,
          editRow.inspectionParameterCode,
          payload,
        );
      } else {
        const payload: CreateCalculationMethodRequest = {
          inspectionObjectCode: objectCode,
          inspectionParameterCode: paramCode,
          testingStandardCode: form.testingStandardCode || undefined,
          algorithmType:
            form.algorithmType as CreateCalculationMethodRequest["algorithmType"],
          specimenCount: Number(form.specimenCount) || 1,
          remark: form.remark || undefined,
        };
        await calculationMethodsCreateCalculationMethod(payload);
      }
      setOpen(false);
      if (selectedStandard) reloadList();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "保存失败",
      );
    }
  };

  const remove = async (row: CalcRow) => {
    if (!confirm("确定删除？")) return;
    await calculationMethodsDeleteCalculationMethod(
      row.inspectionObjectCode,
      row.inspectionParameterCode,
    );
    if (selectedStandard) reloadList();
  };

  return (
    <div data-fn="M06.F05.I01" className="flex flex-col flex-1 min-h-0">
      {/* @entry M06.F05.I02 计算方法新建/编辑按钮（TwoLevelObjectStandardTree 内"新建"+"编辑"） */}
      {/* @entry M06.F05.I05 计算方法删除按钮（TwoLevelObjectStandardTree 内行"删除"） */}
      <TwoLevelObjectStandardTree<CalcRow>
        title="计算方法"
        dataFn="M06.F05.I01"
        listName="calculation-methods"
        listFn={(standardCode) => {
          // 契约参数集只有 inspectionObjectCode/inspectionParameterCode；
          // 后端支持 testingStandardCode 过滤（spec gap），交叉类型透传保持线上行为。
          const listParams: CalculationMethodsListCalculationMethodsParams & {
            testingStandardCode?: string;
          } = { testingStandardCode: standardCode };
          return calculationMethodsListCalculationMethods(listParams).then(
            (rows) => (rows ?? []) as CalcRow[],
          );
        }}
        createDataFn="M06.F05.I02"
        editDataFn="M06.F05.I02"
        deleteDataFn="M06.F05.I05"
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
        reloadSignal={listVersion}
        selectedStandard={selectedStandard}
        onSelectedStandardChange={setSelectedStandard}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={remove}
      />

      <ConfirmModal
        open={open}
        title={editRow ? "编辑计算方法" : "新建计算方法"}
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
                disabled={Boolean(editRow)}
                onChange={(e) =>
                  setForm({ ...form, inspectionObjectCode: e.target.value })
                }
                className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100"
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
                disabled={Boolean(editRow)}
                onChange={(e) =>
                  setForm({ ...form, inspectionParameterCode: e.target.value })
                }
                className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100"
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
