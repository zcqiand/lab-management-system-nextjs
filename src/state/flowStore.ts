import { create } from 'zustand'
import { flowReducer, initialState } from '@/state/flowReducer'
import { TRANSITIONS, ACTION_REQUIRED_ROLE } from '@/state/transitions'
import type { FlowState, FlowAction, FlowStatus } from '@/state/flow-types'

interface FlowStore extends FlowState {
  /** 提交（draft → submitted） */
  submit: (operator: string, comment?: string) => void
  /** 撤回（submitted → draft） */
  recall: (operator: string, comment?: string) => void
  /** 开始检测（submitted → testing） */
  startTesting: (operator: string, comment?: string) => void
  /** 提交复审（testing → review） */
  submitReview: (operator: string, comment?: string) => void
  /** 通过（review → approved，需 admin） */
  approve: (operator: string, operatorRole: string, comment?: string) => void
  /** 拒绝（review → rejected，需 admin） */
  reject: (operator: string, operatorRole: string, comment?: string) => void
  /** 通用转换：显式指定目标状态（需通过转换表校验） */
  transitionTo: (target: FlowStatus, operator: string, operatorRole?: string, comment?: string) => void
  /** 重置到 draft 初态 */
  reset: () => void
  /** 清除 error */
  clearError: () => void
}

/** 将目标状态反查为 action type（用于复用 flowReducer 的权限校验） */
function actionTypeForTarget(target: FlowStatus): string {
  const map: Record<FlowStatus, string> = {
    draft: 'RECALL',
    submitted: 'SUBMIT',
    testing: 'START_TESTING',
    review: 'SUBMIT_REVIEW',
    approved: 'APPROVE',
    rejected: 'REJECT',
  }
  return map[target]
}

export const useFlowStore = create<FlowStore>()((set, get) => {
  function dispatch(action: FlowAction) {
    set((state) => flowReducer(state, action))
  }

  return {
    ...initialState,

    submit: (operator, comment) => dispatch({ type: 'SUBMIT', operator, comment }),
    recall: (operator, comment) => dispatch({ type: 'RECALL', operator, comment }),
    startTesting: (operator, comment) => dispatch({ type: 'START_TESTING', operator, comment }),
    submitReview: (operator, comment) => dispatch({ type: 'SUBMIT_REVIEW', operator, comment }),
    approve: (operator, operatorRole, comment) =>
      dispatch({ type: 'APPROVE', operator, operatorRole, comment }),
    reject: (operator, operatorRole, comment) =>
      dispatch({ type: 'REJECT', operator, operatorRole, comment }),

    transitionTo: (target, operator, operatorRole, comment) => {
      const state = get()
      const allowed = TRANSITIONS[state.status]
      if (!allowed.includes(target)) {
        set({ ...state, error: `非法转换：${state.status} → ${target}` })
        return
      }
      // 复用 reducer 的权限校验路径
      const actionType = actionTypeForTarget(target)
      const requiredRole = ACTION_REQUIRED_ROLE[actionType]
      if (requiredRole && operatorRole && operatorRole !== requiredRole) {
        set({ ...state, error: `权限不足：${actionType} 需要 ${requiredRole} 角色` })
        return
      }
      dispatch({ type: actionType as FlowAction['type'], operator, operatorRole, comment })
    },

    reset: () => set({ ...initialState }),
    clearError: () => set((state) => ({ ...state, error: null })),
  }
})
