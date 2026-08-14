/**
 * 样品/报告类别扩展属性定义（M06.F07 报告名称 extFields 沿用）。
 *
 * 旧 schema（{key,label}）继续兼容：未指定 `type` 时视为 'text'，未指定 `required` 视为 false。
 *
 * `tag` 为可选映射：manifest 单元 `source` 形如 `ext:<key>` 时，模板占位符 `{tag}`
 * 即 <key> 对应的值；同名时可省略 `tag`，缺省等同于 `tag === key`。
 *
 * `source` 决定补录数据落在哪个聚合根：`sample`（默认）走 Sample.ext，
 * `receipt` 走 SampleReceipt 上预留字段（后续 PR 接入）。
 */
export interface ExtFieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  required?: boolean;
  options?: string[];
  tag?: string;
  source?: "sample" | "receipt";
}
