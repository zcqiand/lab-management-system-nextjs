import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  flexuralStrength,
  compressStrength,
  reduceStrengths,
  computeCementFlexural,
  computeCementCompress,
  autoVerdict,
  parseStrengthRecord,
} from "@/features/data-entry/models/cement-strength";
import { DynamicFormRenderer } from "@/features/data-entry/DynamicFormRenderer";
import type { ParamModelProps } from "@/features/data-entry/models/types";
import type { InspectionParameter } from "@/api/endpoints/model";
import type { TechnicalRequirementRow as InspectionTechnicalRequirement } from "@/features/data-entry/models/types";

/**
 * REQ-2026-014 / ADR-0056：水泥胶砂强度（抗折/抗压）——纯算法提炼进
 * models/cement-strength.ts，渲染由 schema 驱动的 DynamicFormRenderer 承接
 * （variant gb17671_compress / gb17671_flexural）。
 */

describe("cementStrength 换算公式（GB/T 17671，40×40×160mm）", () => {
  it("抗折 Rf=1.5·F·L/b³：2kN → 4.7 MPa（系数 2.34375/kN）", () => {
    expect(flexuralStrength(2)).toBe(4.7);
    expect(flexuralStrength(0)).toBe(0);
  });

  it("抗压 Rc=F/A：16kN → 10.0、80kN → 50.0 MPa（系数 0.625/kN）", () => {
    expect(compressStrength(16)).toBe(10);
    expect(compressStrength(80)).toBe(50);
  });
});

describe("reduceStrengths ±10% 剔除", () => {
  it("全部一致 → 无剔除、均值即该值、有效", () => {
    const r = reduceStrengths([50, 50, 50, 50, 50, 50]);
    expect(r.mean).toBe(50);
    expect(r.invalid).toBe(false);
    expect(r.kept.every(Boolean)).toBe(true);
  });

  it("单个离群值被剔除、均值取剩余、仍有效", () => {
    // 30 超出 6 值均值(46.67)的 ±10%(±4.67) → 剔除，剩 5×50 → 50
    const r = reduceStrengths([30, 50, 50, 50, 50, 50]);
    expect(r.mean).toBe(50);
    expect(r.invalid).toBe(false);
    expect(r.kept).toEqual([false, true, true, true, true, true]);
  });

  it("多于一个离群 → 作废 invalid=true（仍给出幸存均值）", () => {
    const r = reduceStrengths([30, 50, 50, 50, 50, 70]);
    expect(r.invalid).toBe(true);
    expect(r.mean).toBe(50);
    expect(r.kept).toEqual([false, true, true, true, true, false]);
  });

  it("无有效荷载 → 均值 undefined、非作废", () => {
    const r = reduceStrengths([0, 0, 0]);
    expect(r.mean).toBeUndefined();
    expect(r.invalid).toBe(false);
  });
});

describe("computeCementFlexural / computeCementCompress", () => {
  it("抗折 3 荷载 → 3 强度 + 均值", () => {
    const r = computeCementFlexural([2, 2, 2]);
    expect(r.strengths).toEqual([4.7, 4.7, 4.7]);
    expect(r.mean).toBe(4.7);
  });

  it("抗压 6 荷载 → 6 强度 + 均值；缺失项记 0/false", () => {
    const r = computeCementCompress([80, 80, 80, 80, 80, 0]);
    expect(r.strengths).toEqual([50, 50, 50, 50, 50, 0]);
    expect(r.mean).toBe(50);
    expect(r.kept[5]).toBe(false);
  });
});

describe("autoVerdict 均值 vs 技术要求", () => {
  const req = (
    over: Partial<InspectionTechnicalRequirement>,
  ): InspectionTechnicalRequirement =>
    ({
      id: "req-1",
      inspectionObjectCode: "OBJ-SP01-P1",
      inspectionParameterCode: "IP-0556",
      judgmentStandardCode: "GB 175-2023",
      valueType: "numeric",
      comparison: "≥",
      minValue: 17,
      judgmentMode: "automatic",
      verificationStatus: "verified",
      sortOrder: 1,
      createdAt: "",
      updatedAt: "",
      ...over,
    }) as InspectionTechnicalRequirement;

  it("≥：均值达标→合格，不达标→不合格", () => {
    expect(autoVerdict(20, req({}))).toBe("合格");
    expect(autoVerdict(15, req({}))).toBe("不合格");
  });

  it("无均值或无要求 → 空（无法判定）", () => {
    expect(autoVerdict(undefined, req({}))).toBe("");
    expect(autoVerdict(20, undefined)).toBe("");
  });
});

describe("parseStrengthRecord", () => {
  it("反解析 loads/strengths/mean；坏 JSON 兜底空", () => {
    const p = parseStrengthRecord(
      JSON.stringify({ loads: [1, 2], strengths: [0.6, 1.3], mean: 1 }),
    );
    expect(p.loads).toEqual([1, 2]);
    expect(p.mean).toBe(1);
    expect(parseStrengthRecord("{bad").loads).toEqual([]);
    expect(parseStrengthRecord(undefined).strengths).toEqual([]);
  });
});

// —— 组件渲染 —— //

const param = (code: string, name: string): InspectionParameter =>
  ({
    id: code,
    code,
    name,
    rawName: name,
    canonicalName: name,
    aliases: [],
    unit: "MPa",
    sourceType: "official",
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
  }) as InspectionParameter;

function makeProps(over: Partial<ParamModelProps> = {}): ParamModelProps {
  return {
    parameter: param("IP-0556", "3 天抗压强度"),
    record: undefined,
    sampleId: "s1",
    standards: [],
    stdParams: [],
    techReqs: [],
    config: undefined,
    onChange: vi.fn(),
    readOnly: false,
    ...over,
  };
}

const verifiedReq: InspectionTechnicalRequirement = {
  tenantId: "TENANT-001",
  id: "req-42.5",
  inspectionObjectCode: "OBJ-SP01-P1",
  inspectionParameterCode: "IP-0556",
  judgmentStandardCode: "GB 175-2023",
  valueType: "numeric",
  comparison: "≥",
  minValue: 17,
  judgmentMode: "automatic",
  verificationStatus: "verified",
  sortOrder: 1,
  createdAt: "",
  updatedAt: "",
};

/** schema 形状与 src/seeds/inspection_param_interfaces.json 的 cement-compress / cement-flexural 同构。 */
const compressSchema = {
  fields: [{ field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 6 }],
  computed: [
    {
      field: "strengths",
      algorithm: "compressive_strength",
      variant: "gb17671_compress",
      from: ["loads"],
      label: "抗压强度 (MPa)",
    },
  ],
  params: { area: 1600 },
};

const flexuralSchema = {
  fields: [{ field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 3 }],
  computed: [
    {
      field: "strengths",
      algorithm: "flexural_strength",
      variant: "gb17671_flexural",
      from: ["loads"],
      label: "抗折强度 (MPa)",
    },
  ],
};

describe("水泥抗压（gb17671_compress）渲染与评定", () => {
  beforeEach(() => cleanup());

  it("渲染 6 个破坏荷载输入框", () => {
    render(<DynamicFormRenderer {...makeProps({ config: compressSchema })} />);
    expect(screen.getAllByLabelText(/试件 \d+ 破坏荷载/)).toHaveLength(6);
  });

  it("有技术要求：录入均值达标 → 自动判合格并 onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({ techReqs: [verifiedReq], onChange, config: compressSchema })}
      />,
    );
    const inputs = screen.getAllByLabelText(/试件 \d+ 破坏荷载/);
    inputs.forEach((el) => fireEvent.change(el, { target: { value: "80" } })); // → 50 MPa ≥ 17
    const last = onChange.mock.calls.at(-1)![0] as { verdict?: string };
    expect(last.verdict).toBe("合格");
    // computed 显示行「{label}：{display}」（label 与值分跨两个节点，取容器文本断言）
    const disp = container.querySelector("div.text-xs.text-gray-600");
    expect(disp?.textContent).toContain("抗压强度 (MPa)：50");
  });

  it("无技术要求：回退手选单项评定", () => {
    render(
      <DynamicFormRenderer {...makeProps({ techReqs: [], config: compressSchema })} />,
    );
    expect(screen.getByLabelText("单项评定")).toBeInTheDocument();
  });

  it("readOnly：输入吞掉 onChange", () => {
    const onChange = vi.fn();
    render(
      <DynamicFormRenderer
        {...makeProps({
          techReqs: [verifiedReq],
          onChange,
          readOnly: true,
          config: compressSchema,
        })}
      />,
    );
    const input = screen.getAllByLabelText(/试件 \d+ 破坏荷载/)[0]!;
    fireEvent.change(input, { target: { value: "80" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("水泥抗折（gb17671_flexural）渲染", () => {
  beforeEach(() => cleanup());

  it("渲染 3 个破坏荷载输入框 + 抗折强度列", () => {
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({
          parameter: param("IP-0555", "3 天抗折强度"),
          config: flexuralSchema,
        })}
      />,
    );
    expect(screen.getAllByLabelText(/试件 \d+ 破坏荷载/)).toHaveLength(3);
    const disp = container.querySelector("div.text-xs.text-gray-600");
    expect(disp?.textContent).toContain("抗折强度 (MPa)");
  });
});
