// M05.F01.I05 — 见证取样跟踪计算内核单测（纯函数 + synthetic 数据）。
//
// 语义（本仓首发定义，BASE 契约化前以此为准）：
//   需见证  = 接样单所属合同的见证人已安排（contract.witness 非空）
//   已见证  = 接样单自身 witness 已登记（接样时见证人在场记录）
//   见证率  = witnessed / requireWitness（三位小数四舍五入；分母 0 → 0）
//   明细    = 需见证接样单逐单：委托书编号/工程名/见证单位（合同带出）/见证人/是否到位
import { describe, expect, it } from "vitest";
import {
  computeWitnessStats,
  type WitnessStatsInputContract,
  type WitnessStatsInputReceipt,
} from "@/lib/summary-witness";

const receipt = (
  o: Partial<WitnessStatsInputReceipt> = {},
): WitnessStatsInputReceipt => ({
  contractId: "C1",
  commissionCode: "WT-000",
  projectName: "默认工程",
  witness: "",
  ...o,
});

const contract = (
  o: Partial<WitnessStatsInputContract> = {},
): WitnessStatsInputContract => ({
  id: "C1",
  contractCode: "HT-001",
  projectName: "默认工程",
  witnessUnit: "默认监理",
  witness: "王见证",
  ...o,
});

describe("见证取样跟踪计算内核（summary witness stats）", () => {
  it("混合场景：合同无见证安排的接样单不计入；登记了见证人才算已见证", () => {
    const contracts = [
      contract({ id: "C1", witness: "王见证", witnessUnit: "监理甲" }),
      contract({ id: "C2", witness: "", witnessUnit: "" }), // 无见证安排
    ];
    const receipts = [
      receipt({ contractId: "C1", commissionCode: "WT-001", witness: "王见证" }),
      receipt({ contractId: "C1", commissionCode: "WT-002", witness: "" }),
      receipt({ contractId: "C2", commissionCode: "WT-003", witness: "赵见证" }), // 合同不要求 → 剔除
    ];
    const s = computeWitnessStats(receipts, contracts);
    expect(s.requireWitness).toBe(2);
    expect(s.witnessed).toBe(1);
    expect(s.witnessRate).toBe(0.5);
    expect(s.details).toHaveLength(2);
    expect(s.details.map((d) => d.commissionCode)).toEqual(["WT-001", "WT-002"]);
  });

  it("全部到位 → rate=1；无任何见证安排 → 全 0 且明细为空", () => {
    const allDone = computeWitnessStats(
      [
        receipt({ witness: "王见证" }),
        receipt({ commissionCode: "WT-002", witness: "王见证" }),
      ],
      [contract()],
    );
    expect(allDone.requireWitness).toBe(2);
    expect(allDone.witnessed).toBe(2);
    expect(allDone.witnessRate).toBe(1);

    const none = computeWitnessStats(
      [receipt({ contractId: "C9", witness: "赵见证" })],
      [contract({ id: "C9", witness: "" })],
    );
    expect(none.requireWitness).toBe(0);
    expect(none.witnessed).toBe(0);
    expect(none.witnessRate).toBe(0);
    expect(none.details).toEqual([]);
  });

  it("见证率三位小数四舍五入（1/3 → 0.333）", () => {
    const s = computeWitnessStats(
      [
        receipt({ commissionCode: "WT-001", witness: "王见证" }),
        receipt({ commissionCode: "WT-002" }),
        receipt({ commissionCode: "WT-003" }),
      ],
      [contract()],
    );
    expect(s.requireWitness).toBe(3);
    expect(s.witnessed).toBe(1);
    expect(s.witnessRate).toBe(0.333);
  });

  it("明细字段：见证单位/见证人自合同带出，接样单字段可覆盖工程名；孤儿接样单（合同缺失）不崩", () => {
    const s = computeWitnessStats(
      [
        receipt({
          contractId: "C1",
          commissionCode: "WT-009",
          projectName: "手工覆盖工程",
          witness: "",
        }),
        receipt({ contractId: "GHOST", commissionCode: "WT-GHOST" }), // 合同表缺失
      ],
      [contract({ projectName: "合同工程", witness: "王见证", witnessUnit: "监理乙" })],
    );
    expect(s.requireWitness).toBe(1); // GHOST 无合同 → 不计入
    const d = s.details[0]!;
    expect(d.commissionCode).toBe("WT-009");
    expect(d.projectName).toBe("手工覆盖工程");
    expect(d.witnessUnit).toBe("监理乙");
    expect(d.witness).toBe("王见证"); // 接样单未登记 → 回退合同见证人
    expect(d.witnessed).toBe(false);
  });
});
