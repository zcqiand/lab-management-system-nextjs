/**
 * 检测项目 ↔ 检测标准 多对多关系（InspectionObjectStandard）— M06.F02.I04 / M06.F02.I05
 *
 * role 单值：TESTING 表示检测依据，JUDGMENT 表示判定依据。
 * 同一项目与同一标准可以同时保存两条记录，分别承担两个角色。
 */

export interface InspectionObjectStandard {
  id: string;
  inspectionObjectCode: string;
  inspectionStandardCode: string;
  /** 检测依据 / 判定依据。 */
  role: "TESTING" | "JUDGMENT";
  remark?: string;
  createdAt: string;
  updatedAt: string;
}
