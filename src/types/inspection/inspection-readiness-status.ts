/**
 * 准备状态枚举（InspectionReadinessStatus）
 *
 * 描述一个检测项目当前是否可用于正式接样与自动评定。
 *   - catalogued：仅目录展示
 *   - under_review：标准/参数/要求正在核验
 *   - operational：已可用于正式接样
 *   - disabled：被机构停用
 */

export type InspectionReadinessStatus = "catalogued" | "under_review" | "operational" | "disabled";

export const INSPECTION_READINESS_STATUSES: InspectionReadinessStatus[] = [
  "catalogued",
  "under_review",
  "operational",
  "disabled",
];
