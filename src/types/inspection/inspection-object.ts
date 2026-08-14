/**
 * 检测项目（InspectionObject）— M06.F02
 *
 * 中文界面显示"检测项目"，TypeScript 实体为 InspectionObject。
 * 一个官方来源项目行可拆分为多个 InspectionObject，但每个对象必须保留
 * sourceProjectNo / sourceProjectName / sourcePage 以便追溯回附件2原文。
 */

export interface InspectionObject {
  id: string;
  /** 稳定编码，例如 OBJ-SP01-P03-FINE。 */
  code: string;
  /** 所属检测专项编码。 */
  inspectionSpecialtyCode: string;
  /** 官方表格中的来源行号。 */
  sourceProjectNo: string;
  /** 官方表格中的来源行名称（拆分前）。 */
  sourceProjectName: string;
  /** 检测项目显示名称。 */
  name: string;
  /** 项目名称是否带 `*`，即资质能力可选项目。 */
  isOptionalForQualification: boolean;
  /** 是否来自官方能力表。 */
  isOfficial: boolean;
  /** 机构是否启用。 */
  enabled: boolean;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
