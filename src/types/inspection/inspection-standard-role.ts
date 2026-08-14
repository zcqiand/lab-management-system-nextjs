/**
 * 检测标准角色枚举（InspectionStandardRole）
 *
 * 用于 InspectionObjectStandard.role：
 *   - TESTING：检测依据
 *   - JUDGMENT：判定依据
 */

export type InspectionStandardRole = "TESTING" | "JUDGMENT";

export const INSPECTION_STANDARD_ROLES: InspectionStandardRole[] = ["TESTING", "JUDGMENT"];
