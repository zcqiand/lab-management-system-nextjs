/**
 * 流程管线（M03 试验过程管理）
 * 单一流程线：receiving → task_assignment → data_entry → review → approval → issuance → archived → completed
 */

/** 流程阶段 */
export type FlowStage =
  | 'receiving'
  | 'task_assignment'
  | 'data_entry'
  | 'review'
  | 'approval'
  | 'issuance'
  | 'archived'
  | 'completed';

/** 流程阶段顺序（前进 = 提交，后退 = 退回/撤回） */
export const FLOW_STAGE_ORDER: FlowStage[] = [
  'receiving',
  'task_assignment',
  'data_entry',
  'review',
  'approval',
  'issuance',
  'archived',
  'completed',
];

/** 流程阶段中文名 */
export const FLOW_STAGE_LABELS: Record<FlowStage, string> = {
  receiving: '接样中',
  task_assignment: '分配中',
  data_entry: '录入中',
  review: '审核中',
  approval: '批准中',
  issuance: '发放中',
  archived: '归档中',
  completed: '已归档',
};

/** 流程动作：submit=提交（前进）、return=退回（后退）、withdraw=撤回（提交人主动收回） */
export type FlowAction = 'submit' | 'return' | 'withdraw';

/** 流程历史条目 */
export interface FlowHistoryEntry {
  action: FlowAction;
  from: FlowStage;
  to: FlowStage;
  operator: string;
  at: string;
  reason?: string;
}

/** 批量流程操作的单条结果 */
export interface FlowActionResult {
  id: string;
  ok: boolean;
  message?: string;
  flowStatus?: FlowStage;
}