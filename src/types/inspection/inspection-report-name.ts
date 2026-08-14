/**
 * 报告名称（InspectionReportName）— M06.F07
 *
 * 取代原 M04.F02 报告模板 + M04.F01 报告类别。
 * 报告名称是检测能力下的中转实体：按 code + name 标识，
 * 挂载四类多对多关联（检测项目 / 检测标准-检测依据 /
 * 检测标准-判定依据 / 检测参数）。
 * 同时承载原「报告类别」的 summaryName + extFields 字段。
 */

import type { ExtFieldDef } from '@/types/api'

export interface InspectionReportName {
  id: string;
  /** 稳定编码。 */
  code: string;
  /** 报告简称（主显示名），用于列表与下拉。 */
  name: string;
  /** 报告全称（正式全名），如"钢筋力学性能检测报告"。 */
  fullName?: string;
  /** 模板路径，静态 HTML 资源路径（非 inline HTML）。 */
  templatePath?: string;
  /** 汇总表名称，如「钢材试验报告汇总表」。原 M04.F01 报告类别的 summaryName。 */
  summaryName?: string;
  /** 样品扩展属性定义（可维护）。原 M04.F01 报告类别的 extFields。 */
  extFields?: ExtFieldDef[];
  /** 描述，可选。 */
  description?: string;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}