import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DynamicFormRenderer } from "@/features/data-entry/DynamicFormRenderer";
import { parseFormSchema } from "@/features/data-entry/models/schema";
import type { InspectionParameter } from "@/api/endpoints/model";
import type { TechnicalRequirementRow as InspectionTechnicalRequirement } from "@/features/data-entry/models/types";

/**
 * ADR-0056 DynamicFormRenderer：schema 驱动动态表单（component_path 退役后的唯一渲染路径）。
 * 覆盖每种字段类型至少一支 + computed 调算法 + onChange 上报 {data,result,verdict}
 * + readOnly 灰化 + 无 config 回退通用采集卡。
 */

const param = (code: string, name = "测试参数"): InspectionParameter =>
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

const REQ: InspectionTechnicalRequirement = {
  id: "req-42.5",
  tenantId: "TENANT-001",
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
} as InspectionTechnicalRequirement;

function makeProps(
  over: Partial<Parameters<typeof DynamicFormRenderer>[0]> = {},
): Parameters<typeof DynamicFormRenderer>[0] {
  return {
    parameter: param("IP-X"),
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

beforeEach(() => cleanup());

describe("parseFormSchema", () => {
  it("合法 config → FormSchema；无 fields/非对象 → null（回退通用采集卡）", () => {
    expect(parseFormSchema(undefined)).toBeNull();
    expect(parseFormSchema({})).toBeNull();
    expect(parseFormSchema({ fields: [] })).toBeNull();
    expect(parseFormSchema("not-object")).toBeNull();
    const s = parseFormSchema({
      fields: [{ field: "loads", type: "number_series", label: "破坏荷载", count: 3 }],
      computed: [
        {
          field: "strengths",
          algorithm: "compressive_strength",
          from: ["loads"],
          label: "强度",
        },
      ],
      params: { area: 22500 },
    });
    expect(s).not.toBeNull();
    expect(s!.fields).toHaveLength(1);
    expect(s!.params.area).toBe(22500);
  });
});

describe("number_series 渲染 N 输入", () => {
  it("count=3 → 3 个「试件 N 破坏荷载」输入框（placeholder=label）", () => {
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({
          config: {
            fields: [
              { field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 3 },
            ],
          },
        })}
      />,
    );
    expect(
      container.querySelectorAll<HTMLInputElement>(
        'input[type="number"][placeholder="破坏荷载 (kN)"]',
      ).length,
    ).toBe(3);
    expect(screen.getAllByLabelText(/试件 \d+ 破坏荷载/)).toHaveLength(3);
  });
});

describe("computed 调算法 + onChange 上报 data/result", () => {
  it("compressive_strength：录荷载 → strengths/representative 进 data，display 出代表值", () => {
    const onChange = vi.fn();
    render(
      <DynamicFormRenderer
        {...makeProps({
          onChange,
          config: {
            fields: [
              { field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 3 },
            ],
            computed: [
              {
                field: "strengths",
                algorithm: "compressive_strength",
                from: ["loads"],
                label: "抗压强度代表值",
              },
            ],
            params: { area: 22500 },
          },
        })}
      />,
    );
    const inputs = screen.getAllByLabelText(/试件 \d+ 破坏荷载/);
    inputs.forEach((el) => fireEvent.change(el, { target: { value: "157.5" } }));
    const last = onChange.mock.calls.at(-1)![0] as {
      data: Record<string, unknown>;
      result: string;
    };
    // 157.5 kN / 22500 mm² → 7 MPa；result = JSON.stringify(data)（报告链 result 兜底解析契约）
    expect(last.data.loads).toEqual([157.5, 157.5, 157.5]);
    expect(last.data.strengths).toEqual([7, 7, 7]);
    expect(last.data.representative).toBe(7);
    expect(JSON.parse(last.result).representative).toBe(7);
    expect(screen.getByText(/抗压强度代表值/)).toBeInTheDocument();
  });

  it("gb17671（±10% 剔除）→ data.mean + 自动单项评定", () => {
    const onChange = vi.fn();
    render(
      <DynamicFormRenderer
        {...makeProps({
          onChange,
          techReqs: [REQ],
          config: {
            fields: [
              { field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 6 },
            ],
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
          },
        })}
      />,
    );
    const inputs = screen.getAllByLabelText(/试件 \d+ 破坏荷载/);
    // 80kN ×6 → 50 MPa ≥ 17 → 合格
    inputs.forEach((el) => fireEvent.change(el, { target: { value: "80" } }));
    const last = onChange.mock.calls.at(-1)![0] as {
      data: Record<string, unknown>;
      verdict: string;
    };
    expect(last.data.mean).toBe(50);
    expect(last.verdict).toBe("合格");
  });
});

describe("select / select_series / input / textarea / input_series / number", () => {
  it("select 渲染 options；select_series 渲染 N 下拉（试件 N 渗水情况）", () => {
    render(
      <DynamicFormRenderer
        {...makeProps({
          config: {
            fields: [
              {
                field: "seepage",
                type: "select_series",
                label: "渗水情况",
                count: 6,
                options: ["未渗", "已渗"],
              },
              {
                field: "basis",
                type: "select",
                label: "检测依据",
                options: ["GB/T 50082-2009"],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getAllByLabelText(/试件 \d+ 渗水情况/)).toHaveLength(6);
    const sel = screen.getByLabelText("检测依据") as HTMLSelectElement;
    expect(sel.options).toHaveLength(2); // 空选项 + 1
  });

  it("input / textarea / number / input_series 各一支", () => {
    render(
      <DynamicFormRenderer
        {...makeProps({
          config: {
            fields: [
              { field: "note", type: "textarea", label: "备注" },
              { field: "who", type: "input", label: "检测人" },
              { field: "max", type: "number", label: "最大干密度 (g/cm³)" },
              { field: "codes", type: "input_series", label: "试样编号", count: 2 },
            ],
          },
        })}
      />,
    );
    expect(screen.getByLabelText("备注")).toBeTruthy();
    expect(screen.getByLabelText("检测人")).toBeTruthy();
    expect(screen.getByLabelText(/最大干密度/)).toBeTruthy();
    expect(screen.getAllByLabelText(/试件 \d+ 试样编号/)).toHaveLength(2);
  });
});

describe("table 类型渲染（颗粒级配）", () => {
  it("rows×columns 单元格 + columnOptions 列头 + rowExtras 附加列", () => {
    const { container } = render(
      <DynamicFormRenderer
        {...makeProps({
          config: {
            fields: [
              {
                field: "sieveRetains",
                type: "table",
                label: "筛孔分计筛余 (%)",
                rows: 2,
                cellType: "number",
                rowExtras: [{ field: "totalBefore", label: "分筛前总量 (g)" }],
              },
            ],
            params: {
              columnOptionsSand: ["4.75mm", "2.36mm", "筛底"],
              columnOptionsGravel: ["90mm"],
              gravel: false,
            },
          },
        })}
      />,
    );
    expect(screen.getByText("4.75mm")).toBeInTheDocument();
    expect(screen.getByText("2.36mm")).toBeInTheDocument();
    // 2 行 × 3 筛孔 = 6 个分计筛余输入 + 2 个分筛前总量
    // 单元格 aria 形状 = `第 N 行 <列名>`
    expect(container.querySelectorAll('input[aria-label$="4.75mm"]').length).toBe(2);
    expect(container.querySelectorAll('input[aria-label$="分筛前总量 (g)"]').length).toBe(
      2,
    );
  });
});

describe("onChange 上报 verdict / readOnly 灰化", () => {
  it("readOnly：输入被吞，onChange 不触发", () => {
    const onChange = vi.fn();
    render(
      <DynamicFormRenderer
        {...makeProps({
          onChange,
          readOnly: true,
          config: {
            fields: [
              { field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 3 },
            ],
          },
        })}
      />,
    );
    const input = screen.getAllByLabelText(/试件 \d+ 破坏荷载/)[0]!;
    expect(input.hasAttribute("readonly") || (input as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.change(input, { target: { value: "80" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("record.data 回显：loads 初值来自 data", () => {
    render(
      <DynamicFormRenderer
        {...makeProps({
          record: {
            id: "r1",
            tenantId: "T",
            sampleId: "s1",
            parameterCode: "IP-X",
            data: { loads: [120, 135, 0] },
            requirement: "",
            result: "",
            createdAt: "",
            updatedAt: "",
          },
          config: {
            fields: [
              { field: "loads", type: "number_series", label: "破坏荷载 (kN)", count: 3 },
            ],
          },
        })}
      />,
    );
    const inputs = screen.getAllByLabelText(/试件 \d+ 破坏荷载/) as HTMLInputElement[];
    expect(inputs[0]!.value).toBe("120");
    expect(inputs[1]!.value).toBe("135");
    expect(inputs[2]!.value).toBe("");
  });
});

describe("无 config / 无 fields → 通用采集卡回退", () => {
  it("渲染四格：检测依据 / 技术要求 / 检测结果 / 单项评定", () => {
    render(<DynamicFormRenderer {...makeProps({ config: undefined })} />);
    expect(screen.getByText("检测依据")).toBeInTheDocument();
    expect(screen.getByText("技术要求")).toBeInTheDocument();
    expect(screen.getByText("检测结果")).toBeInTheDocument();
    expect(screen.getByText("单项评定")).toBeInTheDocument();
  });

  it("通用卡：录检测结果 + 单项评定 → onChange 上报 result/verdict", () => {
    const onChange = vi.fn();
    render(<DynamicFormRenderer {...makeProps({ config: undefined, onChange })} />);
    fireEvent.change(screen.getByPlaceholderText("录入检测结果"), {
      target: { value: "18.2" },
    });
    fireEvent.change(screen.getAllByLabelText("单项评定")[0]!, {
      target: { value: "合格" },
    });
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((p) => (p as { result?: string }).result === "18.2")).toBe(true);
    expect(calls.some((p) => (p as { verdict?: string }).verdict === "合格")).toBe(true);
  });
});
