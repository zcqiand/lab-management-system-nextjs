/**
 * 报告名称 ↔ 检测参数 多对多关系（InspectionReportNameParameter）— M06.F07.I07
 *
 * 报告名称下的参数列表。仅保存多对多关联本身，不携带项目上下文。
 */

export interface InspectionReportNameParameter {
  id: string;
  reportNameCode: string;
  inspectionParameterCode: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}