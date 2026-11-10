import { describe, expect, it } from "vitest";
import { computeConcretePermeability } from "@/features/data-entry/models/concrete";
import { parseFormSchema } from "@/features/data-entry/models/schema";

/**
 * REQ-2026-013 / ADR-0056：抗渗等级算法提炼进 models/concrete.ts 纯函数模块，
 * 渲染由 schema 驱动的 DynamicFormRenderer 承接（旧卡组件已退役）。
 * computeConcretePermeability 按 GB/T 50082-2009 取第 3 个渗水试件的压力为抗渗等级。
 */

function specimensOf(arr: Array<[number, "已渗" | "未渗"]>) {
  return arr.map(([pressure, permeated]) => ({ pressure, permeated }));
}

describe("computeConcretePermeability 抗渗等级（GB/T 50082-2009）", () => {
  it("AC-4: 第 3 个渗水试件压力 0.8 MPa → P8", () => {
    // 6 个试件，前 3 个渗水分别在 0.6 / 0.7 / 0.8 MPa，第 3 个 = #3 = 0.8
    const r = computeConcretePermeability(
      specimensOf([
        [0.6, "已渗"],
        [0.7, "已渗"],
        [0.8, "已渗"],
        [0.9, "未渗"],
        [1.0, "未渗"],
        [1.2, "未渗"],
      ]),
    );
    expect(r.grade).toBe(0.8);
    expect(r.gradeLabel).toBe("P8");
    expect(r.reason).toBeUndefined();
  });

  it("AC-5: 仅 2 个渗水 → 未达到 Pn（取最后渗水压力为 Pn）", () => {
    const r = computeConcretePermeability(
      specimensOf([
        [0.6, "已渗"],
        [0.7, "已渗"],
        [0.8, "未渗"],
        [0.9, "未渗"],
        [1.0, "未渗"],
        [1.2, "未渗"],
      ]),
    );
    expect(r.grade).toBeUndefined();
    expect(r.gradeLabel).toBe("未达到 P7");
    expect(r.reason).toBe("已渗试件 < 3，按国标记为未达到");
  });

  it("AC-6: 全部未渗 → 未达到 P{max}", () => {
    const r = computeConcretePermeability(
      specimensOf([
        [1.2, "未渗"],
        [1.2, "未渗"],
        [1.2, "未渗"],
        [1.2, "未渗"],
        [1.2, "未渗"],
        [1.2, "未渗"],
      ]),
    );
    expect(r.grade).toBeUndefined();
    expect(r.gradeLabel).toBe("未达到 P12");
  });

  it("全部 0 压力未填 → gradeLabel = '—'", () => {
    const r = computeConcretePermeability(
      specimensOf([
        [0, "未渗"],
        [0, "未渗"],
        [0, "未渗"],
        [0, "未渗"],
        [0, "未渗"],
        [0, "未渗"],
      ]),
    );
    expect(r.grade).toBeUndefined();
    expect(r.gradeLabel).toBe("—");
    expect(r.reason).toBe("尚未录入");
  });

  it("已渗试件仅 1 个 → 未达到 Pn", () => {
    const r = computeConcretePermeability(
      specimensOf([
        [0.6, "已渗"],
        [0.7, "未渗"],
        [0.8, "未渗"],
        [0.9, "未渗"],
        [1.0, "未渗"],
        [1.2, "未渗"],
      ]),
    );
    expect(r.grade).toBeUndefined();
    expect(r.gradeLabel).toBe("未达到 P6");
  });

  it("已渗但 pressure=0（数据矛盾）→ 不计入", () => {
    const r = computeConcretePermeability(
      specimensOf([
        [0, "已渗"], // 矛盾：标了已渗但没填压力，不计入
        [0.7, "已渗"],
        [0.8, "已渗"],
        [0.9, "已渗"], // 第 3 个
        [1.0, "未渗"],
        [1.2, "未渗"],
      ]),
    );
    expect(r.grade).toBe(0.9);
    expect(r.gradeLabel).toBe("P9");
  });

  it("AC-9: 非法/缺失 schema → parseFormSchema 返回 null（渲染器回退通用采集卡）", () => {
    expect(parseFormSchema(undefined)).toBeNull();
    expect(parseFormSchema({ fields: [] })).toBeNull();
    expect(parseFormSchema("junk")).toBeNull();
  });
});
