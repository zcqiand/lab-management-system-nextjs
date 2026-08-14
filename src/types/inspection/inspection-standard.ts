/**
 * 检测标准（InspectionStandard）— M06.F04
 *
 * 维护标准编号、名称、版本、状态、来源文件和核验状态；
 * 不直接持有参数，由 InspectionStandardParameter 表达多对多关系。
 */

export interface InspectionStandard {
  id: string;
  /** 标准编号，例如 GB 1499.2-2024。 */
  code: string;
  name: string;
  /** 版本号字符串，例如 2024。 */
  version?: string;
  status: "active" | "superseded" | "draft";
  /** 源文件标识，例如 raw/standards/pdf/GB_1499.2-2024.pdf。 */
  sourceDocumentId?: string;
  /** 源文件 SHA-256。 */
  sourceHash?: string;
  /** 列表展示排序。 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
