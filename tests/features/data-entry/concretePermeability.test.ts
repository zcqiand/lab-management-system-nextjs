import { describe, expect, it } from "vitest";
import { computeConcretePermeability } from "@/features/data-entry/models/ConcretePermeabilityCard";
import { resolveParamInterfaceModel } from "@/features/data-entry/models/registry";

/**
 * REQ-2026-013：参数界面增加混凝土抗渗性能卡。
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

  it("AC-9: 未知模型 key 回退 → resolveParamInterfaceModel 返回默认四格卡", () => {
    const Model = resolveParamInterfaceModel("non-existent-key");
    // 默认四格卡组件名为 DefaultParamCard（以匿名 default export 验证：组件应当可被识别为函数）
    expect(typeof Model).toBe("function");
  });
});