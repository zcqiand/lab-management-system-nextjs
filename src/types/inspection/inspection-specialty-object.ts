/**
 * 检测专项 ↔ 检测项目 多对多关联（InspectionSpecialtyObject）— M06.F02.I07
 *
 * 一个项目可以归属多个专项；一个专项可以包含多个项目。
 * 与 `InspectionObject.inspectionSpecialtyCode` 单值字段不重复，
 * 而是补充官方来源行中可能存在的跨专项项目（如桥梁与道路共用桥涵）。
 */

export interface InspectionSpecialtyObject {
  id: string;
  inspectionSpecialtyCode: string;
  inspectionObjectCode: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}
