/**
 * 检测项目 ↔ 检测参数 多对多关系（InspectionObjectParameter）— M06.F02.I06
 *
 * qualificationLevel 记录资质等级（QUALIFIED/RESTRICTED），并不自动决定每张接样单必须/可选测。
 */

import type { InspectionQualificationLevel } from "./inspection-qualification-level";

export interface InspectionObjectParameter {
  id: string;
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  /** 资质等级：具备能力或受范围限制。 */
  qualificationLevel: InspectionQualificationLevel;
  /** 官方附件2 中的来源页码。 */
  sourcePage?: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}
