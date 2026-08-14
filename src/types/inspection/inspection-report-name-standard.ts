/**
 * 报告名称 ↔ 检测标准 多对多关系（InspectionReportNameStandard）— M06.F07.I05 / M06.F07.I06
 *
 * role 单值：TESTING 表示检测依据，JUDGMENT 表示判定依据；
 * 同一报告名称与同一标准可以同时保存两条记录，分别承担两个角色。
 * 复用 InspectionStandardRole 枚举，不引入新枚举。
 */

import type { InspectionStandardRole } from "./inspection-standard-role";

export interface InspectionReportNameStandard {
  id: string;
  reportNameCode: string;
  inspectionStandardCode: string;
  /** 检测依据 / 判定依据。 */
  role: InspectionStandardRole;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}