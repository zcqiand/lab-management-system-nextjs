// ADR-0056：表单结构 schema（ParamInterface.config）类型与解析。
// component_path 已随契约退役——schema 驱动动态渲染是唯一路径；
// 解析失败（无 fields / 非对象）→ null，调用方回退通用采集卡。

export type SchemaFieldType =
  | "input"
  | "textarea"
  | "number"
  | "select"
  | "input_series"
  | "select_series"
  | "number_series"
  | "table";

const FIELD_TYPES: readonly SchemaFieldType[] = [
  "input",
  "textarea",
  "number",
  "select",
  "input_series",
  "select_series",
  "number_series",
  "table",
];

/** 表格字段每行的附加输入列（如颗粒级配的分筛前/后总量）。 */
export interface SchemaRowExtra {
  field: string;
  label: string;
}

export interface SchemaField {
  /** 数据键（data / 联立算法 from 引用它） */
  field: string;
  label: string;
  type: SchemaFieldType;
  required?: boolean;
  /** 初值（select_series/number_series 常给，如弯曲 90°/合格） */
  defaultValue?: unknown;
  placeholder?: string;
  /** select / select_series 的选项 */
  options?: string[];
  /** * _series 的条数 */
  count?: number;
  unit?: string;
  /** table 专用（legacy 列数形态） */
  rows?: number;
  /** table 列：数字=legacy 列数（columnOptions 形态）；数组=结构化列（见 SchemaTableColumn） */
  columns?: number | SchemaTableColumn[];
  columnLabel?: string;
  /** table 列头（如筛孔名）；缺省用 params.columnOptions* */
  columnOptions?: string[];
  cellType?: "number" | "text";
  rowExtras?: SchemaRowExtra[];
  /** 越限红显（结构化列形态）：column 命中 rule 时该格标红；0/未填不标 */
  highlight?: SchemaTableHighlight;
}

/**
 * table 结构化列（ADR-0056 渲染器扩展，2026-11-10 人裁）：复刻旧 Rebar 卡的
 * 「手输 + 行内逐行计算 + 静态标准列」效果。input=数字输入；
 * computed=逐行派发算法注册表（variant ?? algorithm，与 SchemaComputed 同域）；
 * static=纯文本展示（如 ≤400）。数据形状：data[field] = { <col.field>: number[] }，
 * 按列数组存——报表模板 record:<code>:<colField> 路径可直取。
 */
export interface SchemaTableColumn {
  field: string;
  label: string;
  mode: "input" | "computed" | "static";
  /** computed 列：算法派发键（与 SchemaComputed.variant/algorithm 同域） */
  algorithm?: string;
  /** static 列：固定文本 */
  text?: string;
}

export interface SchemaTableHighlight {
  column: string;
  rule: { op: "lt" | "gt" | "lte" | "gte" | "eq"; value: number };
}

export interface SchemaComputed {
  /** 计算产物写进 data 的键（多与 from[0] 同名，保持旧 result JSON 形状） */
  field: string;
  /** 固定 7 值之一（CalculationAlgorithmType） */
  algorithm: string;
  /**
   * 算法域派发键（本仓扩展）：DB CHECK 把 algorithm 钉死在 7 个枚举值，
   * 细分口径（GB/T 17671 剔除 / 抗渗等级 / 级配…）由 variant 承载；
   * 派发优先 variant，缺省回 algorithm。
   */
  variant?: string;
  /** 参与计算的输入字段（values 里的键） */
  from: string[];
  label: string;
}

export interface FormSchema {
  fields: SchemaField[];
  computed: SchemaComputed[];
  params: Record<string, unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseField(raw: unknown): SchemaField | null {
  if (!isRecord(raw)) return null;
  const field = raw["field"];
  const label = raw["label"];
  const type = raw["type"];
  if (typeof field !== "string" || field === "") return null;
  if (typeof label !== "string" || label === "") return null;
  if (typeof type !== "string" || !FIELD_TYPES.includes(type as SchemaFieldType))
    return null;
  const f = raw as unknown as SchemaField;
  return { ...f, type: type as SchemaFieldType };
}

function parseComputed(raw: unknown): SchemaComputed | null {
  if (!isRecord(raw)) return null;
  const field = raw["field"];
  const algorithm = raw["algorithm"];
  const label = raw["label"];
  const from = raw["from"];
  if (typeof field !== "string" || typeof algorithm !== "string") return null;
  if (typeof label !== "string") return null;
  const fromList = Array.isArray(from)
    ? from.filter((x): x is string => typeof x === "string")
    : [];
  const c = raw as unknown as SchemaComputed;
  return { ...c, algorithm, from: fromList, label };
}

/**
 * config → FormSchema；不合法（非对象 / 无 fields / fields 空 / 字段全坏）→ null。
 * computed / params 可缺省（纯采集表单）。
 */
export function parseFormSchema(config: unknown): FormSchema | null {
  if (!isRecord(config)) return null;
  const rawFields = config["fields"];
  if (!Array.isArray(rawFields) || rawFields.length === 0) return null;
  const fields = rawFields.map(parseField).filter((f): f is SchemaField => f !== null);
  if (fields.length === 0) return null;
  const computed = Array.isArray(config["computed"])
    ? (config["computed"] as unknown[])
        .map(parseComputed)
        .filter((c): c is SchemaComputed => c !== null)
    : [];
  const params = isRecord(config["params"]) ? config["params"] : {};
  return { fields, computed, params };
}
