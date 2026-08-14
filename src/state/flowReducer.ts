import type { FlowState, FlowAction, FlowHistory } from '@/state/flow-types'
import { TRANSITIONS, ACTION_TARGET, ACTION_REQUIRED_ROLE } from '@/state/transitions'

export const initialState: FlowState = {
  status: 'draft',
  history: [],
  error: null,
}

function now(): string {
  return new Date().toISOString()
}

/**
 * 流程状态机 reducer（纯函数）。
 *
 * - 合法转换：更新 status + 追加 history
 * - 非法转换：保持 status 不变，设置 error
 * - 权限不足：保持 status 不变，设置 error
 * - RESET/CLEAR_ERROR：特殊处理
 */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  if (action.type === 'RESET') {
    return { ...initialState }
  }

  if (action.type === 'CLEAR_ERROR') {
    return { ...state, error: null }
  }

  const target = ACTION_TARGET[action.type]
  if (!target) {
    return { ...state, error: `未知动作：${action.type}` }
  }

  // 权限校验
  const requiredRole = ACTION_REQUIRED_ROLE[action.type]
  if (requiredRole && action.operatorRole && action.operatorRole !== requiredRole) {
    return {
      ...state,
      error: `权限不足：${action.type} 需要 ${requiredRole} 角色`,
    }
  }

  // 合法转换校验
  const allowed = TRANSITIONS[state.status]
  if (!allowed.includes(target)) {
    return {
      ...state,
      error: `非法转换：${state.status} → ${target}`,
    }
  }

  const historyEntry: FlowHistory = {
    fromStatus: state.status,
    toStatus: target,
    operator: action.operator ?? 'unknown',
    timestamp: now(),
    comment: action.comment ?? '',
  }

  return {
    status: target,
    history: [...state.history, historyEntry],
    error: null,
  }
}
