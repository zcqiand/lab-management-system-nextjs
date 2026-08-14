import type { FlowStatus } from '@/state/flow-types'

/**
 * 状态转换表：定义每个状态可达的下一状态。
 *
 * draft      → [submitted]                    草稿 → 提交
 * submitted  → [testing, draft]               已提交 → 开始检测 / 撤回草稿
 * testing    → [review, submitted]            检测中 → 提交复审 / 退回已提交
 * review     → [approved, rejected, testing]  复审 → 通过 / 拒绝 / 退回检测
 * approved   → []                             已通过（终态）
 * rejected   → []                             已拒收（终态）
 */
export const TRANSITIONS: Record<FlowStatus, FlowStatus[]> = {
  draft: ['submitted'],
  submitted: ['testing', 'draft'],
  testing: ['review', 'submitted'],
  review: ['approved', 'rejected', 'testing'],
  approved: [],
  rejected: [],
}

/** 动作到目标状态的映射 */
export const ACTION_TARGET: Record<string, FlowStatus> = {
  SUBMIT: 'submitted',
  RECALL: 'draft',
  START_TESTING: 'testing',
  SUBMIT_REVIEW: 'review',
  APPROVE: 'approved',
  REJECT: 'rejected',
}

/** 各动作所需的角色（未列出则不校验角色） */
export const ACTION_REQUIRED_ROLE: Record<string, string> = {
  APPROVE: 'admin',
  REJECT: 'admin',
}
