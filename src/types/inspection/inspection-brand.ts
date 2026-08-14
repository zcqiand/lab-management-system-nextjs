/**
 * 牌号（InspectionBrand）— M04.F09
 *
 * 从 InspectionTechnicalRequirement.brand 字符串字段提为独立实体。
 * 牌号按检测专项过滤（M06.F01）；被技术要求引用时拒绝删除。
 */

export interface InspectionBrand {
  id: string;
  /** 稳定编码。 */
  code: string;
  /** 显示名，例如 HRB400。 */
  name: string;
  /** 适用检测项目；为空表示不限。 */
  inspectionObjectCode?: string;
  /** 备注。 */
  remark?: string;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}