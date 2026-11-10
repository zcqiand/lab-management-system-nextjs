import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  tensileStrength,
  recomputeStrengths,
  meanOfSpecimen,
  parseTensileRecord,
  parseBendRecord,
  TRIAL_COUNT,
  EMPTY_TENSILE,
  type TensileSpecimen,
} from "@/features/data-entry/models/rebar-welding";
import { DynamicFormRenderer } from "@/features/data-entry/DynamicFormRenderer";
import type { ParamModelProps } from "@/features/data-entry/models/types";
import type { InspectionParameter } from "@/api/endpoints/model";
import type { TechnicalRequirementRow as InspectionTechnicalRequirement } from "@/features/data-entry/models/types";

/**
 * REQ-2026-015 / ADR-0056：钢筋焊接接头（抗拉 3 试件 / 弯曲 3 试件）——纯算法
 * 留在 models/rebar-welding.ts，渲染由 schema 驱动的 DynamicFormRenderer 承接
 * （variant welding_tensile / welding_bend）。schema 与
 * src/seeds/inspection_param_interfaces.json 同构。
 */

const PARAM: InspectionParameter = {
  code: "IP-0087",
  name: "抗拉强度",
  rawName: "抗拉强度",
  canonicalName: "抗拉强度",
  aliases: [],
  sourceType: "official",
  sortOrder: 0,
  unit: "MPa",
  createdAt: "2026-07-26",
  updatedAt: "2026-07-26",
};

const REQ: InspectionTechnicalRequirement = {
  id: "req-540",
  tenantId: "TENANT-001",
  inspectionObjectCode: "OBJ-SP99",
  inspectionParameterCode: "IP-0087",
  judgmentStandardCode: "JGJ/T 27-2014",
  comparison: "≥",
  minValue: 540,
  valueType: "numeric",
  judgmentMode: "automatic",
  verificationStatus: "verified",
  sortOrder: 0,
  remark: "HRB400 闪光对焊抗拉强度 ≥ 540 MPa",
  createdAt: "2026-07-26",
  updatedAt: "2026-07-26",
};

const BEND_PARAM: InspectionParameter = {
  ...PARAM,
  code: "IP-0155",
  name: "弯曲性能",
  canonicalName: "弯曲性能",
};

function makeProps(over: Partial<ParamModelProps> = {}): ParamModelProps {
  return {
    parameter: PARAM,
    record: undefined,
    sampleId: "s-1",
    standards: [],
    stdParams: [],
    techReqs: [REQ],
    config: undefined,
    onChange: () => {},
    readOnly: false,
    ...over,
  };
}

describe("tensileStrength（JGJ/T 27-2014 Rm=4000·F/(π·d²)）", () => {
  it("d=25mm, F=270kN → 550.0 MPa（HRB400 实测典型值）", () => {
    expect(tensileStrength(270, 25)).toBe(550);
  });
  it("d=20mm, F=160kN → 509.3 MPa", () => {
    expect(tensileStrength(160, 20)).toBe(509.3);
  });
  it("d=32mm, F=440kN → 547.1 MPa", () => {
    expect(tensileStrength(440, 32)).toBe(547.1);
  });
  it("F=0 或 d=0 → 0（按未填）", () => {
    expect(tensileStrength(0, 25)).toBe(0);
    expect(tensileStrength(270, 0)).toBe(0);
  });
  it("非有限数 → 0", () => {
    expect(tensileStrength(NaN, 25)).toBe(0);
    expect(tensileStrength(270, NaN)).toBe(0);
  });
});

describe("recomputeStrengths + meanOfSpecimen", () => {
  it("3 试件用硬编码 Φ22 后 strengths 跟着重算", () => {
    // Φ22 (d=22mm): Rm = 4000·F/(π·22²)
    // F=270 → 4000*270/(π*484) = 710.3
    // F=268 → 4000*268/(π*484) = 705.0
    // F=272 → 4000*272/(π*484) = 715.5
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 268, 272],
    };
    const out = recomputeStrengths(spec);
    expect(out.strengths[0]).toBe(710.3);
    expect(out.strengths[1]).toBe(705);
    expect(out.strengths[2]).toBe(715.5);
  });
  it("meanOfSpecimen 取有效 strength 的算术均值（无剔除，JGJ/T 27 无 ±10% 规则）", () => {
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 268, 272],
      strengths: [710.3, 705, 715.6],
    };
    expect(meanOfSpecimen(spec)).toBe(710.3);
  });
  it("部分荷载缺失 → mean 仅算存在的", () => {
    const spec: TensileSpecimen = {
      ...EMPTY_TENSILE,
      loads: [270, 0, 272],
      strengths: [710.3, 0, 715.6],
    };
    expect(meanOfSpecimen(spec)).toBe(713);
  });
  it("全空 → undefined", () => {
    expect(meanOfSpecimen(EMPTY_TENSILE)).toBeUndefined();
  });
});

describe("parseTensileRecord 反解析（扁平结构：1 样品 = 3 试件，techReqId 顶层；diameter 字段忽略）", () => {
  it("空 → EMPTY_TENSILE", () => {
    const r = parseTensileRecord(undefined);
    expect(r.loads).toEqual([0, 0, 0]);
    expect(r.techReqId).toBe("");
  });
  it("解析失败 → EMPTY_TENSILE", () => {
    const r = parseTensileRecord("{not json}");
    expect(r.loads).toEqual([0, 0, 0]);
  });
  it("合法 JSON → 字段逐一读出（diameter 字段被忽略）", () => {
    const raw = JSON.stringify({
      diameter: 25, // 历史数据遗留，应被忽略
      techReqId: "req-540",
      techReqLabel: "≥ 540 MPa",
      loads: [270, 268, 272],
      strengths: [550, 546, 554.1],
      fractureDistances: [50, 55, 45],
      fractureCharacteristics: ["母材断裂", "母材断裂", "焊缝断裂"],
    });
    const r = parseTensileRecord(raw);
    expect(r.loads).toEqual([270, 268, 272]);
    expect(r.fractureCharacteristics).toEqual(["母材断裂", "母材断裂", "焊缝断裂"]);
  });
});

describe("parseBendRecord 反解析（扁平结构：1 样品 = 3 试件）", () => {
  it("默认 → EMPTY_BEND", () => {
    const r = parseBendRecord(undefined);
    expect(r.angles).toEqual([90, 90, 90]);
    expect(r.results).toEqual(["合格", "合格", "合格"]);
  });
  it("合法 JSON → 字段读出", () => {
    const raw = JSON.stringify({
      angles: [90, 180, 90],
      results: ["合格", "不合格", "合格"],
    });
    const r = parseBendRecord(raw);
    expect(r.results[1]).toBe("不合格");
  });
  it("旧 specimens[] 数组回退 → 取 specimens[0]", () => {
    const raw = JSON.stringify({
      specimens: [{ angles: [90, 180, 90], results: ["合格", "不合格", "合格"] }],
    });
    const r = parseBendRecord(raw);
    expect(r.angles).toEqual([90, 180, 90]);
    expect(r.results[1]).toBe("不合格");
  });
});

const TENSILE_SCHEMA = {
  fields: [
    {
      field: "loads",
      type: "number_series",
      label: "最大荷重 (kN)",
      count: 3,
      unit: "kN",
    },
    {
      field: "fractureDistances",
      type: "number_series",
      label: "断口距 (mm)",
      count: 3,
      unit: "mm",
    },
    { field: "fractureFeatures", type: "input_series", label: "断裂特征", count: 3 },
  ],
  computed: [
    {
      field: "strengths",
      algorithm: "steel_tensile",
      variant: "welding_tensile",
      from: ["loads"],
      label: "抗拉强度 (MPa)",
    },
  ],
  params: { diameter: 22 },
};

const BEND_SCHEMA = {
  fields: [
    {
      field: "angles",
      type: "number_series",
      label: "弯曲角度 (°)",
      count: 3,
      defaultValue: 90,
    },
    {
      field: "results",
      type: "select_series",
      label: "弯曲结果",
      count: 3,
      defaultValue: "合格",
      options: ["合格", "不合格"],
    },
  ],
  computed: [
    {
      field: "verdictDraft",
      algorithm: "manual",
      variant: "welding_bend",
      from: ["results"],
      label: "弯曲性能评定",
    },
  ],
};

describe("焊接抗拉 UI（welding_tensile，1 样品 = 3 试件，规格 Φ22 进 params）", () => {
  beforeEach(() => cleanup()); // 防上一测试 DOM 残留干扰
  it("空 record → 1 共享技术要求 + 3 行输入（最大荷重 / 断口距 / 断裂特征）", () => {
    render(<DynamicFormRenderer {...makeProps({ config: TENSILE_SCHEMA })} />);
    expect(screen.getAllByLabelText("技术要求", { selector: "select" })).toHaveLength(1);
    expect(screen.getAllByLabelText(/最大荷重/)).toHaveLength(TRIAL_COUNT);
    expect(screen.getAllByLabelText(/断口距/)).toHaveLength(TRIAL_COUNT);
    expect(screen.getAllByLabelText(/断裂特征/)).toHaveLength(TRIAL_COUNT);
  });

  it("输入 F=270kN ×3（Φ22 硬编码在 params）→ 抗拉强度均值 710.3 + onChange 上报 strengths", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DynamicFormRenderer {...makeProps({ config: TENSILE_SCHEMA, onChange })} />,
    );
    const loadInputs = screen.getAllByLabelText(/最大荷重/);
    loadInputs.forEach((el) => fireEvent.change(el, { target: { value: "270" } }));
    // d=22, F=270 → Rm = 710.3；均值同值；显示行「{label}：{display}」分跨两节点，取容器文本断言
    const disp = container.querySelector("div.text-xs.text-gray-600");
    expect(disp?.textContent).toContain("抗拉强度 (MPa)：710.3");
    const last = onChange.mock.calls.at(-1)![0] as {
      data: { strengths?: number[]; mean?: number };
    };
    expect(last.data.strengths).toEqual([710.3, 710.3, 710.3]);
    expect(last.data.mean).toBe(710.3);
  });

  it("均值 ≥ 技术要求 → 自动判 合格", () => {
    render(<DynamicFormRenderer {...makeProps({ config: TENSILE_SCHEMA })} />);
    const loadInputs = screen.getAllByLabelText(/最大荷重/);
    // d=22, F=270 → Rm≈710 MPa；技术要求 ≥540 → 合格
    loadInputs.forEach((el) => fireEvent.change(el, { target: { value: "270" } }));
    expect(screen.getAllByText("合格").length).toBeGreaterThan(0);
  });

  it("readOnly → onChange 不被调用（输入吞掉）", () => {
    const onChange = vi.fn();
    render(
      <DynamicFormRenderer
        {...makeProps({ config: TENSILE_SCHEMA, readOnly: true, onChange })}
      />,
    );
    fireEvent.change(screen.getAllByLabelText(/最大荷重/)[0]!, {
      target: { value: "270" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("焊接弯曲 UI（welding_bend，1 样品 = 3 试件）", () => {
  beforeEach(() => cleanup());
  it("空 record → 3 行（每行 1 角度 + 1 结果，角度/结果取 defaultValue）", () => {
    render(
      <DynamicFormRenderer
        {...makeProps({ parameter: BEND_PARAM, config: BEND_SCHEMA })}
      />,
    );
    expect(screen.getAllByLabelText(/弯曲角度/)).toHaveLength(TRIAL_COUNT);
    expect(screen.getAllByLabelText(/弯曲结果/)).toHaveLength(TRIAL_COUNT);
    const angles = screen.getAllByLabelText(/弯曲角度/) as HTMLInputElement[];
    expect(angles.every((el) => el.value === "90")).toBe(true);
    const results = screen.getAllByLabelText(/弯曲结果/) as HTMLSelectElement[];
    expect(results.every((el) => el.value === "合格")).toBe(true);
  });

  it("3 件全合格 → 整体 合格", () => {
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({ parameter: BEND_PARAM, config: BEND_SCHEMA })}
      />,
    );
    const disp = container.querySelector("div.text-xs.text-gray-600");
    expect(disp?.textContent).toContain("弯曲性能评定：合格");
  });

  it("任一件不合格 → 整体 不合格", () => {
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({ parameter: BEND_PARAM, config: BEND_SCHEMA })}
      />,
    );
    const selects = screen.getAllByLabelText(/弯曲结果/) as HTMLSelectElement[];
    fireEvent.change(selects[1]!, { target: { value: "不合格" } });
    const disp = container.querySelector("div.text-xs.text-gray-600");
    expect(disp?.textContent).toContain("弯曲性能评定：不合格");
  });
});
