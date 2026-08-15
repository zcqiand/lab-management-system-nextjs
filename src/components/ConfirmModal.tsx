import { type ReactNode } from 'react'

interface ConfirmModalProps {
  /** 是否打开 */
  open: boolean
  /** 标题 */
  title: string
  /** 提示消息 */
  message: ReactNode
  /** 确认回调 */
  onConfirm: () => void
  /** 取消回调（点取消按钮或遮罩层触发） */
  onCancel: () => void
  /** 确认按钮文本，默认"确认" */
  confirmText?: string
  /** 取消按钮文本，默认"取消" */
  cancelText?: string
  /** 确认中 loading 状态（禁用按钮 + 文本变化） */
  loading?: boolean
  /** loading 时确认按钮文本，默认"处理中..." */
  loadingText?: string
  /** 确认按钮危险样式（红色），默认 true */
  danger?: boolean
}

/**
 * 通用确认弹窗：用于删除/发布等需要二次确认的操作。
 *
 * 点遮罩层触发 onCancel；点确认触发 onConfirm；点取消触发 onCancel。
 */
export function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  loading = false,
  loadingText = '处理中...',
  danger = true,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        // 仅点击遮罩层本身（非内容区）时触发取消
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="px-6 py-4">
          <div className="text-gray-600 text-sm">{message}</div>
        </div>
        <div className="px-6 py-3 flex justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
