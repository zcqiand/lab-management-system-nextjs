/**
 * 检测专项（InspectionSpecialty）— M06.F01
 *
 * 官方《附件2 检测专项及检测能力表》中 9 个检测专项的领域类型。
 * 中文 UI 统一显示"检测专项"，TypeScript 类型保留 InspectionSpecialty 命名。
 */

export interface InspectionSpecialty {
  id: string;
  /** 稳定编码，例如 SP01。 */
  code: string;
  /** 官方表格中的顺序号，例：一/二/三。 */
  officialNo: string;
  /** 官方显示名称。 */
  name: string;
  /** 是否来自官方能力表；自定义扩展专项时为 false。 */
  isOfficial: boolean;
  /** 机构是否启用；未启用的专项仍可被查询与展示。 */
  enabled: boolean;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
