// ch37 流程引擎类型定义

/** 流程状态机状态 */
export type FlowStatus = 'draft' | 'submitted' | 'testing' | 'review' | 'approved' | 'rejected'

/** 流程动作类型 */
export type FlowActionType =
  | 'SUBMIT'
  | 'RECALL'
  | 'START_TESTING'
  | 'SUBMIT_REVIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'RESET'
  | 'CLEAR_ERROR'

/** 流程动作 */
export interface FlowAction {
  type: FlowActionType
  /** 操作者 ID */
  operator?: string
  /** 操作者角色（用于权限校验） */
  operatorRole?: string
  /** 备注 */
  comment?: string
}

/** 历史记录条目 */
export interface FlowHistory {
  fromStatus: FlowStatus
  toStatus: FlowStatus
  operator: string
  timestamp: string
  comment: string
}

/** 流程状态 */
export interface FlowState {
  status: FlowStatus
  history: FlowHistory[]
  /** 最近一次错误（非法转换/权限不足） */
  error: string | null
}
