import { useCallback, useEffect, useState } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { InspectionReportName, Sample, SampleReceipt } from "@/types/api";

// 4 字典通用行
interface DictItem {
  id: string;
  code: string;
  name: string;
  inspectionObjectCode?: string;
  remark?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  receipt: SampleReceipt;
  onClose: () => void;
  /** 只读模式（非接样阶段查看） */
  readOnly?: boolean;
  /** 内嵌模式：不渲染外层全屏遮罩，直接作为区块嵌入（如编辑接样单）。 */
  inline?: boolean;
}

interface DictOptions {
  models: string[];
  specifications: string[];
  grades: string[];
  brands: string[];
}

/** 型号/规格/等级/牌号：可输入可选择（input + datalist 组合框） */
function ComboInput({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          options.length > 0 ? "可输入或从列表选择" : "可输入（该类别无预置项）"
        }
        className="w-full border rounded px-2 py-1.5"
      />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

const emptyForm = {
  sampleCode: "",
  sampleName: "",
  model: "",
  specification: "",
  grade: "",
  brand: "",
  manufacturer: "",
  structuralPart: "",
  representQuantity: "",
  sampleQuantity: "",
  batchNumber: "",
  supplyUnit: "",
  arrivalDate: "",
  samplingDate: "",
  curingCondition: "",
  age: "",
  remark: "",
};

/** 样品管理（归属接样单）——新建/编辑样品时体现报告类别的扩展属性，
 * 型号/规格/等级/牌号可输入可选择（选项来自对应码表，按报告类别过滤）。
 */
export function SampleManagerModal({ receipt, onClose, readOnly, inline }: Props) {
  const [category, setCategory] = useState<InspectionReportName | null>(null);
  const [dicts, setDicts] = useState<DictOptions>({
    models: [],
    specifications: [],
    grades: [],
    brands: [],
  });
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sample | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [ext, setExt] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: Sample[] }>(API_ROUTES['/samples'], {
        params: { receiptId: receipt.id, page: 1, pageSize: 100 },
      });
      setSamples(res.data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [receipt.id]);

  useEffect(() => {
    fetchSamples();
    // 报告类别（决定扩展属性）+ 四个码表（按类别过滤，供组合框选项）
    apiClient
      .get<{ items: InspectionReportName[] }>(API_ROUTES['/report-names'], {
        params: { page: 1, pageSize: 200 },
      })
      .then((res) =>
        setCategory(res.data.items?.find((r) => r.code === receipt.categoryCode) ?? null),
      )
      .catch(() => setCategory(null));
    const loadDict = async (endpoint: string): Promise<string[]> => {
      try {
        const res = await apiClient.get<{ items: DictItem[] }>(endpoint, {
          params: { categoryCode: receipt.categoryCode, page: 1, pageSize: 200 },
        });
        return res.data.items.map((i) => i.name);
      } catch {
        return [];
      }
    };
    Promise.all([
      loadDict(API_ROUTES['/models']),
      loadDict(API_ROUTES['/specifications']),
      loadDict(API_ROUTES['/grades']),
      loadDict(API_ROUTES['/brands']),
    ]).then(([models, specifications, grades, brands]) =>
      setDicts({ models, specifications, grades, brands }),
    );
  }, [fetchSamples, receipt.categoryCode]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      sampleCode: `${receipt.commissionCode}-S${samples.length + 1}`,
    });
    setExt({});
    setFormOpen(true);
  };

  const openEdit = (s: Sample) => {
    setEditing(s);
    setForm({
      sampleCode: s.sampleCode,
      sampleName: s.sampleName ?? "",
      model: s.model ?? "",
      specification: s.specification ?? "",
      grade: s.grade ?? "",
      brand: s.brand ?? "",
      manufacturer: s.manufacturer ?? "",
      structuralPart: s.structuralPart ?? "",
      representQuantity: s.representQuantity ?? "",
      sampleQuantity: s.sampleQuantity ?? "",
      batchNumber: s.batchNumber ?? "",
      supplyUnit: s.supplyUnit ?? "",
      arrivalDate: s.arrivalDate ?? "",
      samplingDate: s.samplingDate ?? "",
      curingCondition: s.curingCondition ?? "",
      age: s.age ?? "",
      remark: s.remark ?? "",
    });
    setExt({ ...(s.ext ?? {}) });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.sampleCode.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, ext, receiptId: receipt.id };
      if (editing) {
        await apiClient.put(`${API_ROUTES['/samples']}/${editing.id}`, payload);
      } else {
        await apiClient.post(API_ROUTES['/samples'], payload);
      }
      setFormOpen(false);
      await fetchSamples();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`${API_ROUTES['/samples']}/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchSamples();
    } finally {
      setDeleting(false);
    }
  };

  const extDefs = category?.extFields ?? [];

  return (
    <div
      className={
        inline
          ? "border rounded bg-gray-50"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      }
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          inline
            ? "w-full"
            : "bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto"
        }
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h3 className="text-base font-semibold">
              样品管理 — {receipt.commissionCode}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              报告类别：{category?.name ?? receipt.categoryCode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={openCreate}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                新建样品
              </button>
            )}
            {!inline && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-3 text-sm">
          {error && (
            <div role="alert" className="text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <table className="w-full text-sm border rounded overflow-hidden">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">样品编号</th>
                <th className="px-3 py-2 text-left min-w-32">型号/规格/等级/牌号</th>
                <th className="px-3 py-2 text-left min-w-28">生产厂家/产地</th>
                <th className="px-3 py-2 text-left min-w-24">结构部位</th>
                <th className="px-3 py-2 text-left min-w-20">代表数量</th>
                {!readOnly && <th className="px-3 py-2 text-right">操作</th>}
              </tr>
            </thead>
            <tbody>
              {loading && samples.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    加载中...
                  </td>
                </tr>
              )}
              {!loading && samples.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    暂无样品，请新建
                  </td>
                </tr>
              )}
              {samples.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">{s.sampleCode}</td>
                  <td className="px-3 py-2">
                    <div>
                      {[s.model, s.specification, s.grade, s.brand]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{s.manufacturer ?? "—"}</td>
                  <td className="px-3 py-2">{s.structuralPart ?? "—"}</td>
                  <td className="px-3 py-2">{s.representQuantity ?? "—"}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="px-2 py-1 text-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(s)}
                        className="px-2 py-1 text-red-600 hover:underline"
                      >
                        删除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {formOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="text-lg font-semibold">
                  {editing ? "编辑样品" : "新建样品"}
                </h3>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      样品编号 *
                    </label>
                    <input
                      value={form.sampleCode}
                      onChange={(e) => setForm({ ...form, sampleCode: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      样品名称
                    </label>
                    <input
                      value={form.sampleName}
                      onChange={(e) => setForm({ ...form, sampleName: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ComboInput
                    id="dl-model"
                    label="型号（可输入可选择）"
                    value={form.model}
                    options={dicts.models}
                    onChange={(v) => setForm({ ...form, model: v })}
                  />
                  <ComboInput
                    id="dl-spec"
                    label="规格（可输入可选择）"
                    value={form.specification}
                    options={dicts.specifications}
                    onChange={(v) => setForm({ ...form, specification: v })}
                  />
                  <ComboInput
                    id="dl-grade"
                    label="等级（可输入可选择）"
                    value={form.grade}
                    options={dicts.grades}
                    onChange={(v) => setForm({ ...form, grade: v })}
                  />
                  <ComboInput
                    id="dl-brand"
                    label="牌号（可输入可选择）"
                    value={form.brand}
                    options={dicts.brands}
                    onChange={(v) => setForm({ ...form, brand: v })}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      生产厂家/产地
                    </label>
                    <input
                      value={form.manufacturer}
                      onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      placeholder="如：沙钢集团、海螺水泥"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      结构部位
                    </label>
                    <input
                      value={form.structuralPart}
                      onChange={(e) =>
                        setForm({ ...form, structuralPart: e.target.value })
                      }
                      placeholder="如：一层柱A-3"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      代表数量
                    </label>
                    <input
                      value={form.representQuantity}
                      onChange={(e) =>
                        setForm({ ...form, representQuantity: e.target.value })
                      }
                      placeholder="如：60t、200个"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      样品数量
                    </label>
                    <input
                      value={form.sampleQuantity}
                      onChange={(e) =>
                        setForm({ ...form, sampleQuantity: e.target.value })
                      }
                      placeholder="如 1 组 / 3 根"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      出厂编号/批号
                    </label>
                    <input
                      value={form.batchNumber}
                      onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                      placeholder="如 GB2024-0832"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      供销单位
                    </label>
                    <input
                      value={form.supplyUnit}
                      onChange={(e) => setForm({ ...form, supplyUnit: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      进场日期
                    </label>
                    <input
                      type="date"
                      value={form.arrivalDate}
                      onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      取（制）样日期
                    </label>
                    <input
                      type="date"
                      value={form.samplingDate}
                      onChange={(e) => setForm({ ...form, samplingDate: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      养护条件
                    </label>
                    <input
                      value={form.curingCondition}
                      onChange={(e) =>
                        setForm({ ...form, curingCondition: e.target.value })
                      }
                      placeholder="如 标准养护 28d"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      龄期
                    </label>
                    <input
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      placeholder="如 28d"
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      备注
                    </label>
                    <input
                      value={form.remark}
                      onChange={(e) => setForm({ ...form, remark: e.target.value })}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>
                </div>

                {extDefs.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      扩展属性（由报告类别「{category?.name}」定义）
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {extDefs.map((f) => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {f.label}
                          </label>
                          <input
                            value={ext[f.key] ?? ""}
                            onChange={(e) => setExt({ ...ext, [f.key]: e.target.value })}
                            className="w-full border rounded px-2 py-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.sampleCode.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          open={deleteTarget !== null}
          title="删除确认"
          message={`确定删除样品「${deleteTarget?.sampleCode ?? ""}」？其下检测记录将一并删除。`}
          confirmText="确认"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </div>
  );
}

export default SampleManagerModal;
