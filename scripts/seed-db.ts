// scripts/seed-db.ts — 把 @lab/management-system-msw/fixtures 灌到 lab_dev。
// 幂等：TRUNCATE 全部 25 张表 RESTART IDENTITY CASCADE 再灌。
// 对账：灌完逐表 SELECT count(*) 与 fixtures 行数比对，不一致 exit 1。
// DATABASE_URL 缺省时走 fallback（与 drizzle.config.pg.ts 同款，密码 +++ 已 URL 编码）。
import postgres from "postgres";
import {
  contracts, sampleReceipts, samples, testRecords,
  inspectionBrands, inspectionModels, inspectionSpecs, inspectionGrades,
  technicalRequirements, inspectionSpecialties, inspectionObjects,
  inspectionParameters, inspectionStandards, inspectionSpecialtyObjects,
  inspectionObjectParameters, inspectionObjectStandards, inspectionStandardParameters,
  inspectionCalculationRules, inspectionReportNames, inspectionObjectReportNames,
  inspectionReportNameStandards, inspectionReportNameParameters,
  inspectionParamInterfaces, inspectionParamInterfaceLinks,
} from "@lab/management-system-msw/fixtures";
import { toSnake } from "../src/lib/db-map";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev";
const sql = postgres(DATABASE_URL, { max: 1 });

// 表 → fixtures 数组（顺序 = FK 拓扑：字典先于业务，主表先于 junction）
const PLAN: Array<[string, Array<Record<string, unknown>>]> = [
  ["inspection_specialties", inspectionSpecialties],
  ["inspection_objects", inspectionObjects],
  ["inspection_parameters", inspectionParameters],
  ["inspection_standards", inspectionStandards],
  ["inspection_report_names", inspectionReportNames],
  ["inspection_param_interfaces", inspectionParamInterfaces],
  ["inspection_brands", inspectionBrands],
  ["inspection_models", inspectionModels],
  ["inspection_specs", inspectionSpecs],
  ["inspection_grades", inspectionGrades],
  ["inspection_calculation_rules", inspectionCalculationRules],
  ["inspection_technical_requirements", technicalRequirements],
  ["contracts", contracts],
  ["sample_receipts", sampleReceipts],
  ["samples", samples],
  ["test_records", testRecords],
  ["inspection_specialty_objects", inspectionSpecialtyObjects],
  ["inspection_object_parameters", inspectionObjectParameters],
  ["inspection_object_standards", inspectionObjectStandards],
  ["inspection_standard_parameters", inspectionStandardParameters],
  ["inspection_object_report_names", inspectionObjectReportNames],
  ["inspection_report_name_standards", inspectionReportNameStandards],
  ["inspection_report_name_parameters", inspectionReportNameParameters],
  ["inspection_param_interface_links", inspectionParamInterfaceLinks],
  // audit_events 无种子（fixtures 派生路由也不读它），灌空
  ["audit_events", []],
];
// tenants：lab 库不建 tenants 表（V012 注释：租户真相源在 saas），跳过 tenants fixtures。

// V011 引入的 4 个 FK（tech_req brand/model/grade/spec + calc_rule testing_standard）
// 指向码表/标准表，但 msw fixtures 的 technicalRequirements/calculationRules 里存在
// 码表没有的自由文本值（如 HRB400 / Φ22 / 一级 / JGJ 52 / GB/T 28900）。
// 灌库前合成缺失字典行（code=原值，inspectionObjectCode 取 tech-req 行所属对象），
// 保证 FK 成立；不回写 msw fixtures（那是跨端契约，零改动红线）。
type DictRow = Record<string, unknown>;
const STAMP = "2026-01-01T00:00:00Z";
function dictRow(name: string, objectCode: string | null): DictRow {
  return {
    code: name,
    inspectionObjectCode: objectCode,
    name: `${name}（seed 补全）`,
    remark: "seed-db：tech-req/calc-rule FK 引用但码表缺失，灌库时合成",
    sortOrder: 9999,
    createdAt: STAMP,
    updatedAt: STAMP,
    tenantId: "TENANT-001",
  };
}
function standardRow(code: string): DictRow {
  return {
    code,
    name: `${code}（seed 补全）`,
    version: null,
    status: "active",
    sortOrder: 9999,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}
function synthesizeMissingDicts() {
  const std = new Set(inspectionStandards.map((r) => String(r.code)));
  const before = [
    inspectionBrands.length,
    inspectionModels.length,
    inspectionSpecs.length,
    inspectionGrades.length,
  ];
  const dicts: Array<[DictRow[], Set<string>]> = [
    [inspectionBrands, new Set(inspectionBrands.map((r) => String(r.code)))],
    [inspectionModels, new Set(inspectionModels.map((r) => String(r.code)))],
    [inspectionSpecs, new Set(inspectionSpecs.map((r) => String(r.code)))],
    [inspectionGrades, new Set(inspectionGrades.map((r) => String(r.code)))],
  ];
  const objByCode = new Map<string, string>(); // 悬空码 → 首次出现的 inspectionObjectCode
  const addStd: DictRow[] = [];
  for (const r of technicalRequirements) {
    const obj = String(r.inspectionObjectCode ?? "");
    const js = r.judgmentStandardCode;
    if (js && !std.has(String(js))) {
      std.add(String(js));
      addStd.push(standardRow(String(js)));
    }
    const pairs: Array<[DictRow[], Set<string>, unknown]> = [
      [inspectionBrands, dicts[0][1], r.brand],
      [inspectionModels, dicts[1][1], r.model],
      [inspectionSpecs, dicts[2][1], r.spec],
      [inspectionGrades, dicts[3][1], r.grade],
    ];
    for (const [arr, seen, v] of pairs) {
      if (v === undefined || v === null || v === "" || seen.has(String(v))) continue;
      seen.add(String(v));
      if (!objByCode.has(String(v))) objByCode.set(String(v), obj);
      arr.push(dictRow(String(v), objByCode.get(String(v)) ?? null));
    }
  }
  for (const r of inspectionCalculationRules) {
    const t = r.testingStandardCode;
    if (t && !std.has(String(t))) {
      std.add(String(t));
      addStd.push(standardRow(String(t)));
    }
  }
  return { addStd, before };
}

// fixture 键 → 列名不一致的改写（toSnake 之后仍对不上 DB 列名的键）。
// inspection_param_interface_links: fixture 用 inspectionParamInterfaceCode，
// DDL 列是 param_interface_code（V013 更名时 junction 列名没跟着改）。
const KEY_RENAME: Record<string, Record<string, string>> = {
  inspection_param_interface_links: { inspectionParamInterfaceCode: "paramInterfaceCode" },
};

// jsonb 列清单：postgres-js 对 JS 数组会走 pg array 序列化而不是 JSON，
// 必须显式 JSON.stringify 后以文本参数传入（PG 依目标列自动 cast jsonb）。
const JSONB_COLUMNS: Record<string, Set<string>> = {
  inspection_parameters: new Set(["aliases"]),
  inspection_report_names: new Set(["ext_fields"]),
  inspection_param_interfaces: new Set(["config"]),
  sample_receipts: new Set(["judgment_basis", "testing_basis", "test_parameters", "flow_history"]),
  samples: new Set(["ext"]),
  inspection_param_interface_links: new Set(["config"]),
};

// NOT NULL 列在 fixtures 里缺值时补的默认值（逐表核对 DDL 后落；空 = 未发现缺失）。
// 键是 snake_case 列名（KEY_RENAME/toSnake 之后）。
const FILL_DEFAULTS: Record<string, Record<string, unknown>> = {};

function buildRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue; // 缺失键交给 FILL_DEFAULTS / 列 DEFAULT
    const renamed = KEY_RENAME[table]?.[k];
    cols[toSnake(renamed ?? k)] = v;
  }
  for (const [k, v] of Object.entries(FILL_DEFAULTS[table] ?? {})) {
    if (cols[k] === undefined) cols[k] = v;
  }
  const jsonb = JSONB_COLUMNS[table];
  if (jsonb) {
    for (const [k, v] of Object.entries(cols)) {
      if (jsonb.has(k) && v !== null && typeof v !== "string") cols[k] = JSON.stringify(v);
    }
  }
  const fkCols = FK_NULLIFY_BLANK[table];
  if (fkCols) {
    for (const [k, v] of Object.entries(cols)) {
      if (fkCols.has(k) && v === "") cols[k] = null;
    }
  }
  const intCols = NON_INT_TO_REMARK[table];
  if (intCols) {
    for (const [k, camel] of Object.entries(intCols)) {
      const v = cols[k];
      if (typeof v === "number" && !Number.isInteger(v)) {
        const note = `seed注: ${camel}=${v}（DDL integer 存不下小数，置 null，候选 V014 升 numeric）`;
        cols.remark = cols.remark ? `${cols.remark}; ${note}` : note;
        cols[k] = null;
      }
    }
  }
  return cols;
}

async function insertTable(table: string, rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const cols = buildRow(table, row);
    const keys = Object.keys(cols);
    // postgres-js v3 无 sql.join；用 unsafe(text, params) 一次成型。
    // 文本传 jsonb 串，PG 侧按目标列自动 cast。
    const text = `insert into "${table}" (${keys.map((k) => `"${k}"`).join(", ")})
      values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`;
    await sql.unsafe(text, keys.map((k) => cols[k]));
  }
}

// FK 列清单：PG 外键不接受 ''（空串无对应行）。fixtures 里部分 FK 字段是 ''，
// 灌库时归一成 null。覆盖已知 6 处真实 FK（其余 *_code 列均非空且已验证）。
const FK_NULLIFY_BLANK: Record<string, Set<string>> = {
  inspection_technical_requirements: new Set(["brand", "model", "grade", "spec"]),
  inspection_calculation_rules: new Set(["testing_standard_code", "report_name_code"]),
  inspection_param_interface_links: new Set(["report_name_code"]),
  inspection_brands: new Set(["inspection_object_code"]),
  inspection_models: new Set(["inspection_object_code"]),
  inspection_specs: new Set(["inspection_object_code"]),
  inspection_grades: new Set(["inspection_object_code"]),
  contracts: new Set(["inspection_specialty_code"]),
  test_records: new Set(["standard_code"]),
};

// 类型不匹配（DDL vs fixtures）：tech_req 的 min_value/max_value 在 DDL 是 integer，
// 但 msw 种子有 13 处小数（氯离子 ≤0.06、比表面积 ≥3.5、±5.5 等，均为真实物理量，
// 且这些行没有 target_value/expression 承载）。seed 不能改 DDL（shared 真源）也不改
// fixtures（跨端契约），取保守路线：整位列置 null，原值转写进 remark 保底不丢：
//   remark = "<原remark>; seed注: minValue=3.5 (DDL integer 存不了小数)"
// 已知债务：min/max 应为 numeric——候选 shared V014；升列后 seed 可去掉此补丁。
const NON_INT_TO_REMARK: Record<string, Record<string, string>> = {
  inspection_technical_requirements: { min_value: "minValue", max_value: "maxValue" },
};

// 就地按复合键去重。PLAN 里表名是 snake_case，这里按 fixture 数组操作。
// 保留策略：非空字段数最多的行胜（keep-first 会丢掉后行补全的 brand/grade/spec
// 变体信息；同键变体行往往是后行更全）。平局时保首行（稳定）。
function dedupe(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  table: string,
): number {
  const fullness = (r: Record<string, unknown>) =>
    Object.values(r).filter((v) => v !== undefined && v !== null && v !== "").length;
  const best = new Map<string, number>();
  const dropped = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const k = keys.map((key) => String(rows[i][key])).join(" ");
    const cur = best.get(k);
    if (cur === undefined) {
      best.set(k, i);
      continue;
    }
    if (fullness(rows[i]) > fullness(rows[cur])) {
      dropped.add(cur);
      best.set(k, i);
    } else {
      dropped.add(i);
    }
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (dropped.has(i)) rows.splice(i, 1);
  }
  if (dropped.size > 0) {
    console.warn(
      `dedupe ${table}: dropped ${dropped.size} variant rows (PK granularity)`,
    );
  }
  return dropped.size;
}

async function main() {
  // 顺序：先 dedupe 再 synthesize。反过来（旧序）会让 synthesize 扫到随后被
  // dedupe 丢弃的 tech_req 变体行，合成只被死行引用的孤儿字典行（评审 Finding 1）。
  // 4 张复合 PK 表的 fixtures 粒度比 DDL 粗（tech_req 同 obj+param+std 下还有
  // brand/grade/spec 变体行；objStd/pil 同理）。灌库前按 PK 去重（保留最全行，
  // dropped 数打 warn — 评审 Finding 2），对账基线用去重后行数。msw fixtures 本身不动。
  dedupe(technicalRequirements, ["inspectionObjectCode", "inspectionParameterCode", "judgmentStandardCode"], "inspection_technical_requirements");
  dedupe(inspectionObjectStandards, ["inspectionObjectCode", "inspectionStandardCode", "role"], "inspection_object_standards");
  dedupe(inspectionCalculationRules, ["inspectionObjectCode", "inspectionParameterCode"], "inspection_calculation_rules");
  dedupe(inspectionParamInterfaceLinks, ["inspectionParameterCode", "inspectionParamInterfaceCode"], "inspection_param_interface_links");
  const { addStd, before } = synthesizeMissingDicts();
  const synth: Array<[string, number]> = [
    ["inspection_brands", inspectionBrands.length - before[0]],
    ["inspection_models", inspectionModels.length - before[1]],
    ["inspection_specs", inspectionSpecs.length - before[2]],
    ["inspection_grades", inspectionGrades.length - before[3]],
    ["inspection_standards", addStd.length],
  ];
  for (const [t, n] of synth) console.log(`synthesize ${t}: +${n} rows`);
  inspectionStandards.push(...(addStd as typeof inspectionStandards));
  const allTables = PLAN.map(([t]) => t);
  await sql`truncate table ${sql.unsafe(allTables.map((t) => `"${t}"`).join(", "))} restart identity cascade`;
  for (const [table, rows] of PLAN) {
    await insertTable(table, rows);
    console.log(`seeded ${table}: ${rows.length} rows`);
  }
  // 对账
  let bad = 0;
  for (const [table, rows] of PLAN) {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
    const ok = n === rows.length;
    if (!ok) bad++;
    console.log(`${ok ? "OK " : "BAD"} ${table}: db=${n} fixtures=${rows.length}`);
  }
  await sql.end();
  process.exit(bad ? 1 : 0);
}
main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
