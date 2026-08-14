/**
 * 计算规则（InspectionCalculationRule）— M06.F05
 *
 * 按检测项目 + 检测参数 给出原始数据到检测结果的算法；
 * testingStandardCode 可选，限定后表示仅在该检测依据标准下生效。
 */

export type CalculationAlgorithmType =
  | "simple_avg"
  | "compressive_strength"
  | "flexural_strength"
  | "steel_tensile"
  | "formula"
  | "manual";

export interface InspectionCalculationRule {
  id: string;
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  /** 限定到该项目的检测依据标准；为空表示适用于该对象+参数所有检测依据标准。 */
  testingStandardCode?: string;
  /** 限定到该报告名（适用于 M03.F03 数据录入派卡上下文）；为空表示全局适用。 */
  reportNameCode?: string;
  algorithmType: CalculationAlgorithmType;
  /** 试件数量。 */
  specimenCount: number;
  /** 公式或计算说明，formula/manual 时使用。 */
  formula?: string;
  /** 适用条件文本。 */
  conditions?: string;
  /** 修约规则。 */
  roundingRule?: string;
  remark?: string;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
