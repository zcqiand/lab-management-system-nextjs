/**
 * 业务实体类型定义 barrel（建筑工程实验室管理系统 v3）
 *
 * 领域模型：
 *   资源 Contract / Project → 试验过程 SampleReceipt → Sample → TestRecord
 *   基础码表 + 流程管线 + 统计
 *
 * 按功能模块拆分为 3 个目录（参考 inspection 的"一类一文件"模式）：
 *   - common/  通用基础（ApiResult / Page / PageQuery / DateRangeFilter）
 *   - resources/  M02 资源管理（Contract / Project / ...）
 *   - process/    M03 试验过程（Flow / SampleReceipt / Sample / TestRecord / ...）
 *   - system/     M01 系统管理（User / Role / Permission / OrgInfo / ...）
 *   - inspection/ M06 检测能力（已有）
 *
 * 本文件仅做 re-export，保持旧 import 路径（'../../types/api'）继续可用。
 */

export type { ExtFieldDef } from './common';

export type { InspectionReportName } from './inspection/inspection-report-name';
export type { InspectionParameter } from './inspection/inspection-parameter';

export type {
  ApiResult,
  Page,
  PageQuery,
  DateRangeFilter,
} from './common';

export type {
  Contract,
  ContractStatus,
} from './resources';

export type {
  FlowStage,
  FlowAction,
  FlowHistoryEntry,
  FlowActionResult,
  SampleReceipt,
  Sample,
  SampleCreateInput,
  SampleUpdateInput,
  SampleStatus,
  SampleQuery,
  TestRecord,
  DashboardStats,
  SummaryColumn,
  SummaryData,
  SteelSummaryRow,
} from './process';
export { FLOW_STAGE_ORDER, FLOW_STAGE_LABELS } from './process';

export type {
  Permission,
  Role,
  User,
  UserRecord,
  UserQuery,
  UserCreateInput,
  UserUpdateInput,
  ChangePasswordInput,
  RoleRecord,
  RoleQuery,
  RoleCreateInput,
  RoleUpdateInput,
  OrgInfo,
} from './system';