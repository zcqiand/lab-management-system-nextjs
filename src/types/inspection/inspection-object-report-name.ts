/**
 * 检测项目 ↔ 报告名称 多对多关联（InspectionObjectReportName）— M06.F07.I04
 *
 * 一个报告名称可以关联多个检测项目；一个检测项目可以出现在多个报告名称中。
 * 与 M06.F02 项目自身的检测能力无关，仅表示"按场景汇总"的对外配置。
 */

export interface InspectionObjectReportName {
  id: string;
  inspectionObjectCode: string;
  reportNameCode: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}