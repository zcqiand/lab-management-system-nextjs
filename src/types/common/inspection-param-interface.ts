/**
 * 参数界面（InspectionParamInterface）领域类型 —— M06.F08 检测能力模块。
 *
 * 数据模型：
 *   ParamInterfaceRow：参数界面主表（一行 = 一种录入卡片模型，例 default / concrete-compress）
 *   ParamInterfaceLink：参数 ↔ 界面 多对多关联（一个参数可绑多种卡片）
 *
 * 数据来源：mock 内存表（`data/generated/inspection-param-interface.json` + `inspection-parameter-param-interface.json`）
 * 走 `/inspection-param-interfaces` 和 `/inspection-parameter-param-interfaces` 端点。
 */

export interface ParamInterfaceRow {
  code: string
  componentPath: string
  sortOrder: number
  config?: Record<string, unknown>
}

export interface ParamInterfaceLink {
  inspectionParameterCode: string
  inspectionParamInterfaceCode: string
  /**
   * 报告作用域（可选）：仅当接样单 categoryCode === reportNameCode 时该关联生效。
   * 缺省 = 通用关联（对所有报告生效，作为作用域未命中时的兜底）。
   * 用于同一参数在不同报告下走不同录入卡（如 IP-0087 抗拉强度：力学性能 vs 机械连接 vs 焊接）。
   */
  reportNameCode?: string
  /**
   * 链接级配置覆盖：与 ParamInterfaceRow.config 合并；同 key 优先用本字段。
   * 用途：同一录入卡在 不同报告作用域 下可微调（如 particle-gradation 在砂报告用 7 筛孔，
   *       在碎石报告用 12 筛孔 + gravel:true）。
   */
  config?: Record<string, unknown>
}
