/**
 * 资质等级（InspectionQualificationLevel）
 *
 * 用于 InspectionObjectParameter.qualificationLevel：
 *   - QUALIFIED：该项目在本专项中具备相应检测能力
 *   - RESTRICTED：受范围或条件限制
 *
 * 注意：资质等级仅表示资质能力状态；不自动决定每张接样单必须/可选测。
 */

export type InspectionQualificationLevel = "QUALIFIED" | "RESTRICTED";

export const INSPECTION_QUALIFICATION_LEVELS: InspectionQualificationLevel[] = ["QUALIFIED", "RESTRICTED"];
