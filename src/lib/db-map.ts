// src/lib/db-map.ts — row↔DTO 纯函数映射器（snake_case 列 ↔ camelCase 键）。
// 纯函数、零 import：seed 脚本也要用，不能拖进 @/db 的 server-only 链。
// db-queries.ts re-export 本文件；域查询函数后续任务追加在 db-queries.ts。

export const TENANT = "TENANT-001";

// 已知边界（carried ruling，Task 2 评审 Minor 1）：toCamel 与 toSnake 对
// 「下划线+数字」（a_1b）与「连续下划线」（a__b）不对称——
//   toCamel("a_1b") === "a1b"，而 toSnake("a1b") === "a1b"（回不去 a_1b）；
//   toCamel("a__b") === "aB"，而 toSnake("a_b")  === "a_b"（再转一次才变 a__b 的逆不可达）。
// 当前 25 张表列名实测零触发（全部常规 snake_case，无数字段/连续下划线），
// 若未来 DDL 新增此类列名需同步升级这对转换器。

export function toCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function rowToDto<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

export function dtoToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v;
  return out;
}

// drizzle select 返回的行已是 camelCase 属性（generated/schema.ts 映射），但为
// 统一形状（含 jsonb 直通），路由层统一走 rowToDto 兜底命名转换。

// 常用别名表：seed 脚本与查询层共用。25 张表与 generated/schema.ts pgTable 导出一一对应。
export const PG_TABLES = {
  contracts: "contracts",
  receipts: "sample_receipts",
  samples: "samples",
  testRecords: "test_records",
  brands: "inspection_brands",
  models: "inspection_models",
  specs: "inspection_specs",
  grades: "inspection_grades",
  technicalRequirements: "inspection_technical_requirements",
  specialties: "inspection_specialties",
  objects: "inspection_objects",
  specialtyObjects: "inspection_specialty_objects",
  parameters: "inspection_parameters",
  standards: "inspection_standards",
  objectParameters: "inspection_object_parameters",
  objectStandards: "inspection_object_standards",
  standardParameters: "inspection_standard_parameters",
  calculationRules: "inspection_calculation_rules",
  reportNames: "inspection_report_names",
  objectReportNames: "inspection_object_report_names",
  reportNameStandards: "inspection_report_name_standards",
  reportNameParameters: "inspection_report_name_parameters",
  paramInterfaces: "inspection_param_interfaces",
  paramInterfaceLinks: "inspection_param_interface_links",
  auditEvents: "audit_events",
} as const;
