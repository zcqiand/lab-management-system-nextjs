// table 结构化列（mode: input/computed/static）+ highlight 越限红显。
// ADR-0056 渲染器扩展批（2026-11-10 人裁「落这个批」）：钢筋力学性能屈服强度
// 界面要复刻旧 RebarMechNumericCard 的行内表格效果——
//   序号 | 屈服荷载(手输) | 屈服强度(逐行算) | 标准要求(静态) | 越限标红。
// 行为测试：不挂 fnTest（同 DynamicFormRenderer.dom house style）。
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DynamicFormRenderer } from "@/features/data-entry/DynamicFormRenderer";
import { parseFormSchema } from "@/features/data-entry/models/schema";
import type { InspectionParameter } from "@/api/endpoints/model";

const param = (code: string, name = "屈服强度"): InspectionParameter =>
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

function makeProps(over: Partial<Parameters<typeof DynamicFormRenderer>[0]> = {}) {
  return {
    parameter: param("IP-0086"),
    record: undefined,
    sampleId: "S-1",
    standards: [],
    stdParams: [],
    techReqs: [],
    config: undefined,
    onChange: vi.fn(),
    readOnly: false,
    ...over,
  } as Parameters<typeof DynamicFormRenderer>[0];
}

// R = 4000·F/(π·d²)：F=100kN, d=25mm → 4000*100/(π*625) ≈ 203.7
const YIELD_SCHEMA = {
  fields: [
    {
      field: "yieldTable",
      type: "table",
      label: "屈服强度测定",
      rows: 2,
      columns: [
        { field: "loads", label: "屈服荷载 (kN)", mode: "input" },
        { field: "diameters", label: "公称直径 (mm)", mode: "input" },
        {
          field: "strengths",
          label: "屈服强度 (MPa)",
          mode: "computed",
          algorithm: "steel_tensile",
        },
        { field: "req", label: "标准要求", mode: "static", text: "≥400" },
      ],
      highlight: { column: "strengths", rule: { op: "lt", value: 400 } },
    },
  ],
  computed: [],
  params: {},
};

beforeEach(() => cleanup());

describe("parseFormSchema 结构化 table 列", () => {
  it("columns 对象数组原样保留（不吞成列数）", () => {
    const s = parseFormSchema(YIELD_SCHEMA);
    expect(s).not.toBeNull();
    const cols = s!.fields[0]!.columns as Array<{ field: string; mode: string }>;
    expect(Array.isArray(cols)).toBe(true);
    expect(cols.map((c) => c.field)).toEqual(["loads", "diameters", "strengths", "req"]);
    expect(cols[2]!.mode).toBe("computed");
  });
});

describe("table 结构化列渲染", () => {
  it("四种列头齐出：手输/手输/算列/静态文本 ≥400", () => {
    const { container } = render(
      <DynamicFormRenderer {...makeProps({ config: YIELD_SCHEMA })} />,
    );
    for (const h of ["屈服荷载 (kN)", "公称直径 (mm)", "屈服强度 (MPa)", "标准要求"]) {
      expect(screen.getByRole("columnheader", { name: h })).toBeTruthy();
    }
    // 静态列每行渲染 text 原文
    expect(container.textContent).toContain("≥400");
    // 行数 = rows
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("逐行计算：录 F=100kN/d=25mm → 该行强度 ≈203.7，另一行仍 -", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <DynamicFormRenderer {...makeProps({ config: YIELD_SCHEMA, onChange })} />,
    );
    fireEvent.change(screen.getByLabelText("第 1 行 屈服荷载 (kN)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("第 1 行 公称直径 (mm)"), {
      target: { value: "25" },
    });
    await new Promise((r) => setTimeout(r, 0));
    const row1 = container.querySelectorAll("tbody tr")[0]!;
    const row2 = container.querySelectorAll("tbody tr")[1]!;
    expect(row1.textContent).toContain("203.7");
    expect(row2.textContent).toContain("-");
    // data 形状：按列数组存（报表模板 record:CODE:<col> 路径可直取）
    const last = onChange.mock.calls.at(-1)?.[0] as {
      data: Record<string, Record<string, number[]>>;
    };
    const t = last.data["yieldTable"]!;
    expect(t.loads).toEqual([100, 0]);
    expect(t.diameters).toEqual([25, 0]);
    expect(t.strengths![0]).toBeCloseTo(203.7, 0);
  });

  it("highlight 越限红显：203.7 < 400 标红，≥400 退红", async () => {
    const { container } = render(
      <DynamicFormRenderer {...makeProps({ config: YIELD_SCHEMA })} />,
    );
    fireEvent.change(screen.getByLabelText("第 1 行 屈服荷载 (kN)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("第 1 行 公称直径 (mm)"), {
      target: { value: "25" },
    });
    await new Promise((r) => setTimeout(r, 0));
    let row1 = container.querySelectorAll("tbody tr")[0]!;
    expect(row1.querySelector(".text-red-600")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("第 1 行 屈服荷载 (kN)"), {
      target: { value: "250" },
    });
    await new Promise((r) => setTimeout(r, 0));
    row1 = container.querySelectorAll("tbody tr")[0]!;
    expect(row1.textContent).toContain("509.3");
    expect(row1.querySelector(".text-red-600")).toBeNull();
  });

  it("只读灰化：readOnly 时输入框 disabled/readOnly", () => {
    const { container } = render(
      <DynamicFormRenderer {...makeProps({ config: YIELD_SCHEMA, readOnly: true })} />,
    );
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(inputs.length).toBeGreaterThan(0);
    for (const i of inputs) expect(i.readOnly).toBe(true);
  });
});
