// 算法域注册表（ADR-0056 裁定①：计算逻辑归算法域）。
// 渲染层（DynamicFormRenderer）只按 schema.computed 的 variant ?? algorithm 到这里派发，
// 自身不内联任何业务计算；每支算法把「旧卡写进 result 的 JSON 形状」原样产出到
// AlgorithmOutput.data（报告链 reportTemplateData 以 rec.data 直取、result 老 JSON 兜底）。
//
// 派发键：variant（本仓扩展——DB CHECK 把 algorithm 钉死在 7 个枚举值，细分口径由
// variant 承载）优先，缺省回 algorithm。未注册键回退 manual（纯透传）。
import type { TechnicalRequirement as InspectionTechnicalRequirement } from "@/api/endpoints/model";
import {
  computeCementCompress,
  computeCementFlexural,
  autoVerdict,
  round1,
} from "./cement-strength";
import {
  meanOf,
  ratioTensileOverYield,
  ratioMeasuredOverSpec,
  round2,
  strengthFromLoad,
} from "./rebar-mechanics";
import { tensileStrength } from "./rebar-welding";
import { computeConcreteCompress, computeConcretePermeability } from "./concrete";
import {
  averageByCol,
  computeCumulative,
  computeFinenessModulus,
  sieveColumns,
} from "./gradation";
import { computeCompactionDegree, computeCompactionPeak } from "./soil";
import type { CrossRecordInput } from "./types";
import { type FormSchema, type SchemaComputed, type SchemaField } from "./schema";

/** 手动评定可选项（强度/比值/焊接类卡的回退评定）。 */
export const MANUAL_VERDICTS = ["合格", "不合格"] as const;

/** 渲染层维护的「一行表格输入」状态（table 字段，如颗粒级配）。 */
export interface TableRowState {
  /** 每列数值（长度 = 列头数） */
  cells: number[];
  /** rowExtras 附加输入（field → 值） */
  extras: Record<string, number>;
}

export interface AlgorithmContext {
  /** 当前全部字段值（number 系 0=未填；字符串系 ""=未填） */
  values: Record<string, unknown>;
  params: Record<string, unknown>;
  /** calcRule.specimenCount（字段自带 count 缺省时兜底） */
  specimenCount: number;
  techReq: InspectionTechnicalRequirement | undefined;
  techReqId: string;
  techReqLabel: string;
  crossRecord: CrossRecordInput | undefined;
}

export interface AlgorithmOutput {
  /** 旧卡 result JSON 形状的计算产物（模板取数路径） */
  data: Record<string, unknown>;
  /** 计算行显示值（渲染成「{label}：{display}」） */
  display?: string;
  /** 附注警告（如 GB/T 17671 作废提示） */
  warning?: string;
  /** 自动单项评定；"" 视为未判定 */
  verdict?: "合格" | "不合格" | "";
  /** 无自动判定时可手选的评定项 */
  manualVerdict?: readonly string[];
  /** 需要技术要求选择器（data 里落 techReqId/techReqLabel，requirement 文本上报） */
  needsTechReq?: boolean;
  /** 联立自动模式下输入锁定（比值卡 autoMode） */
  lockInputs?: boolean;
  /** 多行补充显示（如级配每行累计筛余/细度模数） */
  displayLines?: string[];
}

export type AlgorithmFn = (ctx: AlgorithmContext) => AlgorithmOutput;

// —— 取值小工具（渲染层状态约定：number 系 0=未填） ——

function num1(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function numArr(v: unknown, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const x = Array.isArray(v) ? v[i] : undefined;
    return num1(x);
  });
}

function strArr(v: unknown, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const x = Array.isArray(v) ? v[i] : undefined;
    return typeof x === "string" ? x : "";
  });
}

function tableRows(v: unknown): TableRowState[] {
  if (!Array.isArray(v)) return [];
  return v.map((r) => {
    const row = (r ?? {}) as Partial<TableRowState>;
    const cells = Array.isArray(row.cells) ? row.cells.map((x) => num1(x)) : [];
    const extras: Record<string, number> = {};
    for (const [k, x] of Object.entries(row.extras ?? {})) extras[k] = num1(x);
    return { cells, extras };
  });
}

/** computed.from[0] 的数值序列。 */
function firstFromNumbers(ctx: AlgorithmContext, from: string[], n?: number): number[] {
  const raw = ctx.values[from[0] ?? ""];
  if (n === undefined) {
    return Array.isArray(raw) ? raw.map((x) => num1(x)) : [];
  }
  return numArr(raw, n);
}

// —— 各算法 ——

/** GB/T 17671 水泥胶砂强度（±10% 剔除 → 均值 → 自动评定）。 */
function gb17671(kind: "compress" | "flexural"): AlgorithmFn {
  return (ctx) => {
    const loads = firstFromNumbers(ctx, ["loads"]);
    const area = num1(ctx.params["area"]) || 1600;
    const span = num1(ctx.params["span"]) || 100;
    const width = num1(ctx.params["width"]) || 40;
    const res =
      kind === "compress"
        ? computeCementCompress(loads, area)
        : computeCementFlexural(loads, span, width);
    const data: Record<string, unknown> = {
      loads,
      strengths: res.strengths,
      kept: res.kept,
      mean: res.mean,
      invalid: res.invalid,
    };
    return {
      data,
      display: res.mean === undefined ? "—" : String(res.mean),
      warning: res.invalid ? "离群值超 ±10%，按 GB/T 17671 结果作废" : undefined,
      verdict: autoVerdict(res.mean, ctx.techReq) || undefined,
      manualVerdict: MANUAL_VERDICTS,
      needsTechReq: true,
    };
  };
}

/** 平口径抗压强度（无剔除）：F/A → 代表值=算术均值（0 计入，锁定旧混凝土卡行为）。 */
const compressiveStrengthPlain: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["loads"]);
  const area = num1(ctx.params["area"]) || 22500;
  const { strengths, representative } = computeConcreteCompress(loads, area);
  return {
    data: { loads, strengths, representative },
    display: representative === undefined ? "—" : String(representative),
  };
};

/** 平口径抗折强度（无剔除）。 */
const flexuralStrengthPlain: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["loads"]);
  const span = num1(ctx.params["span"]) || 100;
  const width = num1(ctx.params["width"]) || 40;
  const strengths = loads.map((l) =>
    l > 0 ? Math.round(((1.5 * l * 1000 * span) / width ** 3) * 10) / 10 : 0,
  );
  const valid = strengths.filter((v) => v > 0);
  const representative =
    valid.length === 0
      ? undefined
      : Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
  return {
    data: { loads, strengths, representative },
    display: representative === undefined ? "—" : String(representative),
  };
};

/** 钢筋拉伸/屈服（GB/T 228.1 / JGJ 107）：逐组 荷载×直径 → 强度；连接模式带断裂位置。 */
const steelTensile: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["loads"]);
  const diasRaw = ctx.values["diameters"];
  const dias = Array.isArray(diasRaw) ? diasRaw.map((x) => num1(x)) : [];
  let diameter: number;
  let strengths: number[];
  if (dias.length > 0 && dias.some((d) => d > 0)) {
    strengths = loads.map((l, i) => strengthFromLoad(l, dias[i] ?? 0));
    diameter = dias.find((d) => d > 0) ?? 0;
  } else {
    diameter = num1(ctx.params["diameter"]);
    strengths = loads.map((l) => strengthFromLoad(l, diameter));
  }
  const mean = meanOf(strengths, round1);
  const data: Record<string, unknown> = {
    diameter,
    techReqId: ctx.techReqId,
    techReqLabel: ctx.techReqLabel,
    loads,
    strengths,
    mean,
  };
  const locs = ctx.values["fractureLocations"];
  if (Array.isArray(locs)) data["fractureLocations"] = strArr(locs, loads.length);
  return {
    data,
    display: mean === undefined ? "—" : String(mean),
    verdict: autoVerdict(mean, ctx.techReq) || undefined,
    manualVerdict: MANUAL_VERDICTS,
    needsTechReq: true,
  };
};

/** 钢筋焊接接头抗拉（JGJ/T 27-2014）：Φ22 硬编码（params.diameter）、无 ±10% 剔除、扁平形状。 */
const weldingTensile: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["loads"]);
  const diameter = num1(ctx.params["diameter"]) || 22;
  const strengths = loads.map((l) => tensileStrength(l, diameter));
  const mean = meanOf(strengths, round1);
  const distances = numArr(ctx.values["fractureDistances"], loads.length);
  const features = strArr(ctx.values["fractureFeatures"], loads.length);
  return {
    data: {
      techReqId: ctx.techReqId,
      techReqLabel: ctx.techReqLabel,
      loads,
      strengths,
      mean,
      fractureDistances: distances,
      fractureCharacteristics: features,
    },
    display: mean === undefined ? "—" : String(mean),
    verdict: autoVerdict(mean, ctx.techReq) || undefined,
    manualVerdict: MANUAL_VERDICTS,
    needsTechReq: true,
  };
};

/** 断后伸长率（passthrough %）：录入值 → 均值；data.loads 保持旧 RebarMechResult 键。 */
const elongation: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["elongations", "loads"]);
  const strengths = loads.map((v) => (v > 0 ? round1(v) : 0));
  const mean = meanOf(strengths, round1);
  return {
    data: {
      techReqId: ctx.techReqId,
      techReqLabel: ctx.techReqLabel,
      loads,
      strengths,
      mean,
    },
    display: mean === undefined ? "—" : String(mean),
    verdict: autoVerdict(mean, ctx.techReq) || undefined,
    manualVerdict: MANUAL_VERDICTS,
    needsTechReq: true,
  };
};

/** 强屈比 / 超强比：跨记录联立自动算；缺值回退手动；data 同时落 mean/jz（模板两口径）。 */
const yieldRatio: AlgorithmFn = (ctx) => {
  const manual = firstFromNumbers(ctx, ["ratios", "loads"]);
  const count = manual.length || ctx.specimenCount || 2;
  const cr: CrossRecordInput | undefined = ctx.crossRecord;
  let auto: number[] | null = null;
  const t = cr?.tensileStrengths;
  const y = cr?.yieldStrengths;
  if (t && y && t.some((v) => v > 0) && y.some((v) => v > 0)) {
    auto = ratioTensileOverYield(t, y, count);
  } else {
    const spec = cr?.specStandardYield;
    if (y && spec && spec > 0 && y.some((v) => v > 0)) {
      auto = ratioMeasuredOverSpec(y, spec, count);
    }
  }
  const strengths = auto ?? manual.map((v) => (v > 0 ? round2(v) : 0));
  const mean = meanOf(strengths, round2);
  return {
    data: {
      techReqId: ctx.techReqId,
      techReqLabel: ctx.techReqLabel,
      loads: manual,
      strengths,
      mean,
      jz: mean,
    },
    display: mean === undefined ? "—" : String(mean),
    verdict: autoVerdict(mean, ctx.techReq) || undefined,
    manualVerdict: MANUAL_VERDICTS,
    needsTechReq: true,
    lockInputs: auto !== null,
  };
};

/** 混凝土抗渗等级（GB/T 50082-2009）：6 试件 压力×渗水情况 → Pn。 */
const permeabilityGrade: AlgorithmFn = (ctx) => {
  const pressures = firstFromNumbers(ctx, ["pressures"], 6);
  const seepage = strArr(ctx.values["seepage"], 6);
  const specimens = pressures.map((p, i) => ({
    pressure: p,
    permeated: seepage[i] === "已渗" ? ("已渗" as const) : ("未渗" as const),
  }));
  const { grade, gradeLabel, reason } = computeConcretePermeability(specimens);
  return {
    data: {
      specimens,
      grade,
      gradeLabel,
      ...(grade === undefined ? { reason } : {}),
    },
    display: gradeLabel,
  };
};

/** 钢筋焊接弯曲：3 试件 角度+结果 → 整体评定（任一不合格即不合格）。 */
const weldingBend: AlgorithmFn = (ctx) => {
  const angles = firstFromNumbers(ctx, ["angles"], 3);
  const results = strArr(ctx.values["results"], 3);
  const overall = results.some((r) => r === "不合格")
    ? "不合格"
    : results.every((r) => r === "合格")
      ? "合格"
      : "";
  return {
    data: { angles, results },
    display: overall || "—",
    verdict: overall || undefined,
    manualVerdict: MANUAL_VERDICTS,
  };
};

/** 颗粒级配（GB/T 14684/14685）：分计筛余 → 累计筛余 → 细度模数；行产物 + 平均。 */
const gradation: AlgorithmFn = (ctx) => {
  const cols = sieveColumns(ctx.params);
  const n = cols.length;
  const raw = tableRows(ctx.values["sieveRetains"]);
  const rows = raw.map((r) => {
    const retainedPct = numArr(r.cells, n);
    const cumulativePct = computeCumulative(retainedPct);
    return {
      retainedPct,
      totalBefore: num1(r.extras["totalBefore"]),
      totalAfter: num1(r.extras["totalAfter"]),
      cumulativePct,
      finenessModulus: computeFinenessModulus(cumulativePct, n),
    };
  });
  const average = averageByCol(rows.map((r) => r.retainedPct));
  const averageCumulativePct = averageByCol(rows.map((r) => r.cumulativePct));
  const fms = rows.map((r) => r.finenessModulus).filter((v) => v > 0);
  const averageFinenessModulus =
    fms.length > 0
      ? Math.round((fms.reduce((a, b) => a + b, 0) / fms.length) * 10) / 10
      : 0;
  const displayLines = rows.map(
    (r, i) =>
      `第 ${i + 1} 行 累计筛余 (%)：${r.cumulativePct.map((c) => (c === 0 ? "—" : String(c))).join(" / ")}｜细度模数：${r.finenessModulus === 0 ? "—" : r.finenessModulus}`,
  );
  displayLines.push(
    `平均值 (%)：${average.map((v) => (v === 0 ? "—" : String(v))).join(" / ")}`,
  );
  return {
    data: { rows, sieveCount: n, average, averageCumulativePct, averageFinenessModulus },
    displayLines,
  };
};

/** 土工击实峰值（GB/T 50123-2019）：N 组（含水率,干密度）→ 二次拟合峰值。 */
const compactionPeak: AlgorithmFn = (ctx) => {
  const dryRaw = ctx.values["dryDensities"];
  const dry = Array.isArray(dryRaw) ? dryRaw.map((x) => num1(x)) : [];
  const wet = numArr(ctx.values["waterContents"], dry.length);
  const points = dry.map((d, i) => ({ dryDensity: d, moisture: wet[i] ?? 0 }));
  const { maxDryDensity, optimalMoisture } = computeCompactionPeak(points);
  return {
    data: { points, maxDryDensity, optimalMoisture },
    display: `${maxDryDensity ?? "—"} / ${optimalMoisture ?? "—"}`,
  };
};

/** 土工压实度：逐试样 湿密度+含水率 → 干密度 → 压实度 → 逐行评定 + 整卡评定。 */
const compactionDegree: AlgorithmFn = (ctx) => {
  const maxDD = num1(ctx.values["maxDryDensity"]);
  const count = 6;
  const codes = strArr(ctx.values["codes"], count);
  const parts = strArr(ctx.values["parts"], count);
  const layers = strArr(ctx.values["layers"], count);
  const design = numArr(ctx.values["designDegrees"], count);
  const wet = numArr(ctx.values["wetDensities"], count);
  const moist = numArr(ctx.values["waterContents"], count);
  const rows = Array.from({ length: count }, (_, i) => {
    const base = {
      code: codes[i] ?? "",
      part: parts[i] ?? "",
      layer: layers[i] ?? "",
      designDegree: design[i] ?? 0,
      wetDensity: wet[i] ?? 0,
      moisture: moist[i] ?? 0,
    };
    return {
      ...base,
      ...computeCompactionDegree(base, maxDD),
      maxDryDensity: maxDD,
    };
  });
  const filled = rows.filter((r) => r.verdict !== "");
  const overall =
    filled.length === 0
      ? undefined
      : filled.every((r) => r.verdict === "合格")
        ? ("合格" as const)
        : ("不合格" as const);
  return {
    data: { maxDryDensity: maxDD, rows },
    display: overall ?? "—",
    verdict: overall,
  };
};

/** 平口径均值（simple_avg）。 */
const simpleAvg: AlgorithmFn = (ctx) => {
  const loads = firstFromNumbers(ctx, ["loads"]);
  const strengths = loads.map((v) => (v > 0 ? round2(v) : 0));
  const mean = meanOf(strengths, round2);
  return {
    data: { loads, strengths, mean },
    display: mean === undefined ? "—" : String(mean),
  };
};

/** manual / formula / 未注册键：纯透传（无计算产物）。 */
const passthrough: AlgorithmFn = () => ({ data: {} });

/** 算法注册表（导出供链路测试校验 schema 派发键可解析）。 */
export const REGISTRY: Record<string, AlgorithmFn> = {
  gb17671_compress: gb17671("compress"),
  gb17671_flexural: gb17671("flexural"),
  compressive_strength: compressiveStrengthPlain,
  flexural_strength: flexuralStrengthPlain,
  steel_tensile: steelTensile,
  welding_tensile: weldingTensile,
  elongation,
  yield_ratio: yieldRatio,
  auto_calc_ratio: yieldRatio,
  permeability_grade: permeabilityGrade,
  welding_bend: weldingBend,
  gradation,
  compaction_peak: compactionPeak,
  compaction_degree: compactionDegree,
  simple_avg: simpleAvg,
  manual: passthrough,
  formula: passthrough,
};

/** 按 variant ?? algorithm 派发；未注册 → 纯透传。 */
export function runAlgorithm(
  computed: SchemaComputed,
  ctx: AlgorithmContext,
): AlgorithmOutput {
  const fn = REGISTRY[computed.variant ?? computed.algorithm] ?? passthrough;
  return fn(ctx);
}

// —— 初值装载（record.data 直取优先，旧 result JSON 兜底；data 胜出） ——

type DataBag = Record<string, unknown>;

function parseLegacyResult(resultRaw: string | undefined): DataBag {
  if (!resultRaw || !resultRaw.trimStart().startsWith("{")) return {};
  try {
    const obj = JSON.parse(resultRaw) as unknown;
    return typeof obj === "object" && obj !== null && !Array.isArray(obj)
      ? (obj as DataBag)
      : {};
  } catch {
    return {};
  }
}

/**
 * record → 渲染层初值。取数顺序：record.data 直取 > record.result 旧 JSON 反解析（迁移债，
 * 已种子链的记录 data 为 {}、旧形状在 result 里）；再按 variant 走专属装载器
 * （specimens/rows/points 等复合形状展开成平铺序列），最后按字段名直取。
 */
export function initValuesFromSchema(
  schema: FormSchema,
  data: DataBag | undefined,
  resultRaw: string | undefined,
  calcSpecimenCount: number | undefined,
): Record<string, unknown> {
  const legacy = parseLegacyResult(resultRaw);
  const bag: DataBag = { ...legacy, ...(data ?? {}) };
  const primary = schema.computed[0];
  const key = primary ? (primary.variant ?? primary.algorithm) : "";

  const out: Record<string, unknown> = {};
  const fieldCount = (f: SchemaField) => f.count ?? calcSpecimenCount ?? 2;

  // variant 专属装载器：返回「字段名 → 序列/标量」，未命中的字段走通用 data[field] 直取。
  const specimenList = Array.isArray(bag["specimens"])
    ? (bag["specimens"] as unknown[])
    : null;
  const rowsList = Array.isArray(bag["rows"]) ? (bag["rows"] as unknown[]) : null;
  const pointsList = Array.isArray(bag["points"]) ? (bag["points"] as unknown[]) : null;
  const loadsArr = bag["loads"];
  const fractureChars = bag["fractureCharacteristics"];

  for (const f of schema.fields) {
    const n = fieldCount(f);
    switch (f.type) {
      case "number": {
        out[f.field] = num1(bag[f.field]) || num1(f.defaultValue);
        break;
      }
      case "number_series": {
        let src: unknown = bag[f.field];
        if (key === "permeability_grade" && specimenList) {
          src = specimenList.map((s) =>
            num1((s as DataBag)?.[f.field === "pressures" ? "pressure" : ""]),
          );
        } else if (key === "compaction_peak" && pointsList) {
          const k = f.field === "dryDensities" ? "dryDensity" : "moisture";
          src = pointsList.map((s) => num1((s as DataBag)?.[k]));
        } else if (
          key === "compaction_degree" &&
          rowsList &&
          [
            "codes",
            "parts",
            "layers",
            "designDegrees",
            "wetDensities",
            "waterContents",
          ].includes(f.field)
        ) {
          const k =
            f.field === "codes"
              ? "code"
              : f.field === "parts"
                ? "part"
                : f.field === "layers"
                  ? "layer"
                  : f.field === "designDegrees"
                    ? "designDegree"
                    : f.field === "wetDensities"
                      ? "wetDensity"
                      : "moisture";
          src = rowsList.map((s) => num1((s as DataBag)?.[k]));
        } else if (
          (key === "elongation" || key === "yield_ratio") &&
          (f.field === "elongations" || f.field === "ratios")
        ) {
          src = loadsArr;
        }
        const arr = numArr(src, n);
        // number 系约定 0=未填：schema 带数值 defaultValue 时，未填位补默认（旧卡 angles=90 同款语义）
        out[f.field] =
          typeof f.defaultValue === "number" && f.defaultValue !== 0
            ? arr.map((v) => (v === 0 ? f.defaultValue : v))
            : arr;
        break;
      }
      case "input_series": {
        let src: unknown = bag[f.field];
        if (key === "welding_tensile" && f.field === "fractureFeatures") {
          src = fractureChars;
        }
        const arr = Array.isArray(src) ? src : [];
        out[f.field] = Array.from({ length: n }, (_, i) => {
          const x = arr[i];
          return typeof x === "string" ? x : "";
        });
        break;
      }
      case "select_series": {
        let src: unknown = bag[f.field];
        if (key === "permeability_grade" && specimenList && f.field === "seepage") {
          src = specimenList.map((s) =>
            (s as DataBag)?.["permeated"] === "已渗" ? "已渗" : "未渗",
          );
        }
        const arr = Array.isArray(src) ? src : [];
        const fallback =
          typeof f.defaultValue === "string" ? f.defaultValue : (f.options?.[0] ?? "");
        out[f.field] = Array.from({ length: n }, (_, i) => {
          const x = arr[i];
          return typeof x === "string" && x !== "" ? x : fallback;
        });
        break;
      }
      case "select": {
        const v = bag[f.field];
        out[f.field] =
          typeof v === "string" && v !== ""
            ? v
            : typeof f.defaultValue === "string"
              ? f.defaultValue
              : "";
        break;
      }
      case "table": {
        // 结构化列形态（input/computed/static）：data[field] = { <col>: number[] }
        if (Array.isArray(f.columns)) {
          const rows = f.rows ?? 2;
          const src = (
            typeof bag[f.field] === "object" && bag[f.field] !== null
              ? (bag[f.field] as DataBag)
              : {}
          ) as DataBag;
          const outBag: DataBag = {};
          for (const c of f.columns) {
            const prev = Array.isArray(src[c.field]) ? (src[c.field] as unknown[]) : [];
            const arr = Array.from({ length: rows }, (_, i) =>
              typeof prev[i] === "number" && Number.isFinite(prev[i]) ? prev[i] : 0,
            );
            outBag[c.field] = arr;
          }
          out[f.field] = outBag;
          break;
        }
        // legacy：级配 rows[i].retainedPct / totalBefore / totalAfter → cells+extras
        const colCount =
          f.columnOptions?.length ??
          sieveColumns(schema.params).length ??
          (typeof f.columns === "number" ? f.columns : 7);
        const srcRows = rowsList ?? [];
        out[f.field] = Array.from({ length: f.rows ?? 2 }, (_, ri) => {
          const r = (srcRows[ri] ?? {}) as DataBag;
          const pct = Array.isArray(r["retainedPct"])
            ? (r["retainedPct"] as unknown[])
            : [];
          return {
            cells: numArr(pct, colCount),
            extras: {
              totalBefore: num1(r["totalBefore"]),
              totalAfter: num1(r["totalAfter"]),
            },
          };
        });
        break;
      }
      default: {
        // input / textarea
        const v = bag[f.field];
        out[f.field] =
          typeof v === "string"
            ? v
            : typeof f.defaultValue === "string"
              ? f.defaultValue
              : "";
      }
    }
  }
  return out;
}
