/**
 * M03 试验过程管理领域类型 barrel
 *
 * 状态：Phase 4 暂保留本地 per-entity 文件作为契约镜像（与 inspection/ 一致策略）。
 */

export type {
  FlowStage,
  FlowAction,
  FlowHistoryEntry,
  FlowActionResult,
} from './flow';
export { FLOW_STAGE_ORDER, FLOW_STAGE_LABELS } from './flow';
export type { SampleReceipt } from './sample-receipt';
export type {
  Sample,
  SampleCreateInput,
  SampleUpdateInput,
  SampleStatus,
  SampleQuery,
} from './sample';
export type { TestRecord } from './test-record';
export type {
  DashboardStats,
  SummaryColumn,
  SummaryData,
  SteelSummaryRow,
} from './summary';