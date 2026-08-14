/**
 * 检测标准 ↔ 检测参数 多对多关系（InspectionStandardParameter）— M06.F04.I04
 *
 * 仅保存标准与参数的多对多关联本身，
 * 不得将“项目上下文”字段（项目、条件）放在这里。
 */

export interface InspectionStandardParameter {
  id: string;
  inspectionStandardCode: string;
  inspectionParameterCode: string;
  createdAt: string;
  updatedAt: string;
}
