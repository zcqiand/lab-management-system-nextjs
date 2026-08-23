/**
 * M06 检测能力领域类型 barrel
 *
 * 状态：Phase 4 暂保留本地 per-entity 文件作为契约镜像。
 *   shared @lab/management-system-shared/schemas 提供 zod schema 作 codegen 真相源；
 *   本仓类型层级先于 Phase 5+6 数据迁移时再整体切到 shared。
 */

export type { InspectionSpecialty } from "./inspection-specialty";
export type { InspectionObject } from "./inspection-object";
export type { InspectionParameter } from "./inspection-parameter";
export type { InspectionStandard } from "./inspection-standard";
export type { InspectionObjectParameter } from "./inspection-object-parameter";
export type { InspectionObjectStandard } from "./inspection-object-standard";
export type { InspectionStandardParameter } from "./inspection-standard-parameter";
export type { InspectionSpecialtyObject } from "./inspection-specialty-object";
export type { InspectionStandardRole } from "./inspection-standard-role";
export type { InspectionQualificationLevel } from "./inspection-qualification-level";
export type { InspectionReadinessStatus } from "./inspection-readiness-status";
export type { InspectionCalculationMethod, CalculationAlgorithmType } from "./inspection-calculation-method";
export type {
  InspectionTechnicalRequirement,
  RequirementValueType,
  RequirementComparison,
  RequirementVerificationStatus,
  RequirementJudgmentMode,
} from "./inspection-technical-requirement";
export type { InspectionReportName } from "./inspection-report-name";
export type { InspectionBrand } from "./inspection-brand";
export type { InspectionModel } from "./inspection-model";
export type { InspectionGrade } from "./inspection-grade";
export type { InspectionSpec } from "./inspection-spec";
export type { InspectionObjectReportName } from "./inspection-object-report-name";
export type { InspectionReportNameStandard } from "./inspection-report-name-standard";
export type { InspectionReportNameParameter } from "./inspection-report-name-parameter";

export { INSPECTION_STANDARD_ROLES } from "./inspection-standard-role";
export { INSPECTION_QUALIFICATION_LEVELS } from "./inspection-qualification-level";
export { INSPECTION_READINESS_STATUSES } from "./inspection-readiness-status";