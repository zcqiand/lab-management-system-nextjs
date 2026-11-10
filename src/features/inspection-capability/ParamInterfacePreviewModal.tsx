"use client";
// REF 同名组件移植（ADR-0056：registry/componentPath 退役，预览改为渲染 DynamicFormRenderer 只读视图）。
import { DynamicFormRenderer } from "@/features/data-entry/DynamicFormRenderer";
import { buildPreviewProps, type PreviewInterfaceRow } from "./previewSampleMock";

/**
 * 参数界面预览弹窗（M06.F08.I06）：按行的 config schema 渲染动态表单渲染器，
 * 只读 + mock 单样品 + 1 条技术要求。让维护者在配置参数界面时直接看到表单长什么样。
 */
export function ParamInterfacePreviewModal({
  row,
  onClose,
}: {
  row: PreviewInterfaceRow;
  onClose: () => void;
}) {
  const props = buildPreviewProps(row);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="参数界面预览"
      data-fn="M06.F08.I06"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            预览 — {row.name ?? "参数界面"}
            <span className="ml-2 font-mono text-xs text-gray-500">
              v{row.version ?? 1}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-gray-400 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-gray-500">
          只读预览（mock 单样品 + 示例技术要求）；实际录入以数据录入页为准。
        </p>
        <div className="pointer-events-none">
          <DynamicFormRenderer {...props} />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParamInterfacePreviewModal;
