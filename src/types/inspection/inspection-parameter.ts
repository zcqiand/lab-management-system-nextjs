/**
 * 检测参数（InspectionParameter）— M06.F03
 *
 * 跨检测项目、跨检测标准复用的参数主数据；保存原文、规范名、试验方法、别名和单位。
 */

export interface InspectionParameter {
  id: string;
  /** 稳定编码，例如 IP-STE001。 */
  code: string;
  /** 显示名。 */
  name: string;
  /** 官方或来源中出现的原始名称。 */
  rawName: string;
  /** 经过整理的中文规范名。 */
  canonicalName: string;
  /** 参数附带的试验方法文本。 */
  methodText?: string;
  /** 历史/别名列表。 */
  aliases: string[];
  /** 参数单位，可空。 */
  unit?: string;
  /** official / custom。 */
  sourceType: "official" | "custom";
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
