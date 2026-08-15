import { useFlowStore } from '@/state/flowStore'
import type { FlowStatus } from '@/state/flow-types'

interface FlowPanelProps {
  operatorId: string
  operatorRole: string
}

const STATUS_LABEL: Record<FlowStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  testing: '检测中',
  review: '复审中',
  approved: '已通过',
  rejected: '已拒收',
}

const STATUS_BADGE_CLASS: Record<FlowStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  testing: 'bg-yellow-100 text-yellow-700',
  review: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

/** 判断当前角色是否可执行某动作 */
function canPerform(action: string, operatorRole: string): boolean {
  if (action === 'APPROVE' || action === 'REJECT') {
    return operatorRole === 'admin'
  }
  return true
}

export function FlowPanel({ operatorId, operatorRole }: FlowPanelProps) {
  const { status, history, error, submit, recall, startTesting, submitReview, approve, reject, reset } =
    useFlowStore()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">检测流程</h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex flex-wrap gap-2">
          {status === 'draft' && (
            <button
              onClick={() => submit(operatorId, '提交检测')}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              提交检测
            </button>
          )}
          {status === 'submitted' && (
            <>
              <button
                onClick={() => startTesting(operatorId, '开始检测')}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                开始检测
              </button>
              <button
                onClick={() => recall(operatorId, '撤回')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
              >
                撤回
              </button>
            </>
          )}
          {status === 'testing' && (
            <button
              onClick={() => submitReview(operatorId, '提交复审')}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              提交复审
            </button>
          )}
          {status === 'review' && canPerform('APPROVE', operatorRole) && (
            <>
              <button
                onClick={() => approve(operatorId, operatorRole, '通过')}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                通过复审
              </button>
              <button
                onClick={() => reject(operatorId, operatorRole, '拒绝')}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                拒绝
              </button>
            </>
          )}
          {(status === 'approved' || status === 'rejected') && (
            <span className="text-gray-500 text-sm">
              {status === 'approved' ? '流程已完成（已通过）' : '流程已终止（已拒收）'}
            </span>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 ml-auto"
          >
            重置
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-3 text-red-600 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-2">操作历史</h3>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无操作记录</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((h, idx) => (
              <li key={idx} className="flex items-center gap-2 text-gray-600">
                <span className="font-mono text-xs text-gray-400">
                  {new Date(h.timestamp).toLocaleString('zh-CN')}
                </span>
                <span>
                  {STATUS_LABEL[h.fromStatus]} → {STATUS_LABEL[h.toStatus]}
                </span>
                <span className="text-gray-400">|</span>
                <span>操作人：{h.operator}</span>
                {h.comment && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span>{h.comment}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default FlowPanel
