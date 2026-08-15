import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import type { ExtFieldDef } from "@/types/common/ext-field-def";
import type { Sample } from "@/types/api";

export interface SampleExtFieldsModalProps {
  open: boolean;
  /** 当前报告类别的 ext 字段定义（来自 InspectionReportName.extFields）。空数组 → 弹窗直接关闭。 */
  extFields: ExtFieldDef[];
  /** 当前样品的 ext 现状（首次进入时填进表单），可能为空对象。 */
  initialExt: Record<string, string> | undefined;
  /** 模板中的占位符 tag → 字段 key 映射（extField.tag ?? extField.key）。补录说明用。 */
  tagByKey?: Record<string, string>;
  /** 提交回调：返回合并后的 ext，调用方负责持久化（如 apiClient.put(/samples/:id, { ext })）。 */
  onSubmit: (mergedExt: Record<string, string>) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * 类别级扩展属性补录弹窗（M03.F01.I07）。
 *
 * 触发条件：当前接样单的 categoryCode 对应的 InspectionReportName.extFields 非空。
 * 录入位置：仅 Sample.ext（本次实现）。后续若 extField.source === 'receipt'，
 * 走 SampleReceipt 上的预留字段，下个 PR 接入。
 *
 * UI：每行 label + 对应控件（text/number/date/select）。
 * 必填项未填 → 阻止提交（红框 + 错误文案）。
 */
export function SampleExtFieldsModal({
  open,
  extFields,
  initialExt,
  tagByKey,
  onSubmit,
  onCancel,
  loading = false,
}: SampleExtFieldsModalProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 打开时用 initialExt 同步；extFields 列表变化时也重置，避免陈旧 key 残留。
  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const f of extFields) next[f.key] = initialExt?.[f.key] ?? "";
    setDraft(next);
    setErrors({});
  }, [open, extFields, initialExt]);

  const title = useMemo(() => {
    if (extFields.length === 0) return "类别参数补录";
    return `类别参数补录（${extFields.length} 项）`;
  }, [extFields.length]);

  if (!open) return null;

  if (extFields.length === 0) {
    // 防御：调用方应在 extFields 为空时直接不渲染弹窗。
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        data-fn="M03.F01.I07"
      >
        <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw] p-5">
          <p className="text-sm text-gray-600">当前报告类别没有需要补录的扩展属性。</p>
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of extFields) {
      if (!f.required) continue;
      const v = (draft[f.key] ?? "").trim();
      if (!v) next[f.key] = "必填";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    const merged: Record<string, string> = { ...(initialExt ?? {}) };
    for (const f of extFields) {
      const v = (draft[f.key] ?? "").trim();
      if (v) merged[f.key] = v;
    }
    await onSubmit(merged);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-fn="M03.F01.I07"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl w-md max-w-[92vw] max-h-[85vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">
            补录结果会持久化到当前样品的扩展属性，下次预览自动带入。
          </p>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          {extFields.map((f) => {
            const tag = f.tag ?? f.key;
            const value = draft[f.key] ?? "";
            const err = errors[f.key];
            const inputId = `ext-field-${f.key}`;
            return (
              <div key={f.key}>
                <label
                  htmlFor={inputId}
                  className="block text-sm font-medium mb-1 text-gray-700"
                >
                  {f.label}
                  {f.required ? <span className="text-red-500 ml-0.5">*</span> : null}
                  {tagByKey?.[f.key] ? (
                    <span className="ml-2 font-mono text-[10px] text-gray-400">
                      {"{"}
                      {tagByKey[f.key]}
                      {"}"}
                    </span>
                  ) : (
                    <span className="ml-2 font-mono text-[10px] text-gray-400">
                      {"{"}
                      {tag}
                      {"}"}
                    </span>
                  )}
                </label>
                {renderControl(f, inputId, value, (v) =>
                  setDraft((d) => ({ ...d, [f.key]: v })),
                )}
                {err ? <p className="text-xs text-red-500 mt-1">{err}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 flex justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={loading}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "保存中…" : "保存并预览"}
          </button>
        </div>
      </form>
    </div>
  );
}

function renderControl(
  f: ExtFieldDef,
  inputId: string,
  value: string,
  setValue: (v: string) => void,
): ReactElement {
  const t = f.type ?? "text";
  if (t === "select") {
    return (
      <select
        id={inputId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">请选择</option>
        {(f.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (t === "number") {
    return (
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }
  if (t === "date") {
    return (
      <input
        id={inputId}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }
  return (
    <input
      id={inputId}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export default SampleExtFieldsModal;

// Re-export Sample type so test files can import from this module if convenient.
export type { Sample };
