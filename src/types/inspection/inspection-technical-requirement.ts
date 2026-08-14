/**
 * 技术要求（InspectionTechnicalRequirement）— M06.F06
 *
 * 按检测项目 + 检测参数 + 判定依据标准 + 条件 用于单项评定。
 * 只有 verificationStatus=verified 且 judgmentMode=automatic 的记录才参与自动评定。
 */

export type RequirementValueType = "numeric" | "string" | "range" | "formula" | "manual";
export type RequirementComparison = "≥" | "≤" | "=" | "range" | "eq";
export type RequirementVerificationStatus = "draft" | "reviewed" | "verified" | "rejected";
export type RequirementJudgmentMode = "automatic" | "manual";

export interface InspectionTechnicalRequirement {
  id: string;
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  /** 限定为该项目的判定依据标准；不允许使用检测依据标准。 */
  judgmentStandardCode: string;
  /** 适用条件文本。 */
  conditions?: string;
  valueType: RequirementValueType;
  /** numeric 时使用。 */
  minValue?: number;
  maxValue?: number;
  /** range/eq 时使用。 */
  targetValue?: string;
  /** formula 时使用。 */
  expression?: string;
  unit?: string;
  /** 兼容历史比较语义。 */
  comparison: RequirementComparison;
  judgmentMode: RequirementJudgmentMode;
  verificationStatus: RequirementVerificationStatus;
  clause?: string;
  sourcePage?: number;
  sourceHash?: string;
  /** 适用牌号（FK → InspectionBrand.code），空表示不限。 */
  brand?: string;
  /** 适用型号（FK → InspectionModel.code），空表示不限。 */
  model?: string;
  /** 适用等级（FK → InspectionGrade.code），空表示不限。 */
  grade?: string;
  /** 适用规格（FK → InspectionSpec.code），空表示不限。 */
  spec?: string;
  /** 适用筛孔（颗粒级配 / 筛分试验专用；如 4.75mm / 2.36mm / 1.18mm）。当本字段非空时，
   *  与 grade（= 级配区）联合唯一定位「区×筛孔」的累计筛余区间
   *  （GB/T 14684-2022 表 3 等二维限值表）。其他参数忽略此字段。 */
  sieve?: string;
  remark?: string;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
