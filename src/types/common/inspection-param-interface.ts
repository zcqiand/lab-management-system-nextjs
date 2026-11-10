/**
 * 参数界面（InspectionParamInterface）领域类型 —— M06.F08 检测能力模块。
 *
 * 数据模型：
 *   ParamInterfaceRow：参数界面主表（一行 = 一种录入卡片模型，例 default / concrete-compress）
 *   ParamInterfaceLink：参数 ↔ 界面 多对多关联（一个参数可绑多种卡片）
 *
 * 数据来源：mock 内存表（`data/generated/inspection-param-interface.json` + `inspection-parameter-param-interface.json`）
 * 走契约端点 `/api/param-interfaces` 和 `/api/param-interfaces/links`
 * （REQ-2026-001：REF legacy 路径已收敛到 shared tsp 契约路径）。
 */

export interface ParamInterfaceRow {
  code: string;
  /** 表单结构版本，结构迭代升级用，服务端管理，缺省 1（ADR-0056） */
  version: number;
  /** 表单结构定义（Schema）：{ title?, fields[], computed?, params? }（ADR-0056） */
  config?: Record<string, unknown>;
}

export interface ParamInterfaceLink {
  inspectionParameterCode: string;
  paramInterfaceCode: string;
  /**
   * 报告作用域（可选）：仅当接样单 categoryCode === reportNameCode 时该关联生效。
   * 缺省 = 通用关联（对所有报告生效，作为作用域未命中时的兜底）。
   * 用于同一参数在不同报告下走不同录入卡（如 IP-0087 抗拉强度：力学性能 vs 机械连接 vs 焊接）。
   */
  reportNameCode?: string;
  /**
   * 检测依据作用域（可选，ADR-0056 追加裁定）：仅当检测依据 === inspectionStandardCode 时生效；
   * 缺省 = 不限依据（兜底）。config 字段已随契约退役（link 不再承载配置覆盖）。
   */
  inspectionStandardCode?: string;
}
