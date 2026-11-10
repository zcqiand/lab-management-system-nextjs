import { describe, it, expect } from "vitest";
import { resolveInterfaceByParam } from "@/features/data-entry/models/resolveInterfaceByParam";

/**
 * ADR-0056 第二波契约：componentPath / sortOrder / link.config 全部退役，
 * link 新增 inspectionStandardCode；多条 link 优先级 = 作用域特异性
 * （standardCode 精确命中 > reportNameCode 命中 > 通用兜底），同层取先登记者。
 */

const interfaces = [
  { code: "default", version: 1 },
  { code: "cc", version: 1, config: { area: 22500 } },
  { code: "cc100", version: 1, config: { area: 10000 } },
] as never[];

describe("resolveInterfaceByParam", () => {
  it("一个参数绑一个界面 → 返回 interfaceCode + config + version", () => {
    const r = resolveInterfaceByParam(interfaces, [
      { inspectionParameterCode: "IP-1", paramInterfaceCode: "cc" },
    ]);
    expect(r["IP-1"]).toEqual({
      interfaceCode: "cc",
      config: { area: 22500 },
      version: 1,
    });
  });
  it("一个参数绑多条通用 link → 取先登记者（稳定序，无 sortOrder）", () => {
    const r = resolveInterfaceByParam(interfaces, [
      { inspectionParameterCode: "IP-1", paramInterfaceCode: "cc100" },
      { inspectionParameterCode: "IP-1", paramInterfaceCode: "cc" },
    ]);
    expect(r["IP-1"]!.interfaceCode).toBe("cc100"); // 先登记者胜出
    expect((r["IP-1"]!.config as { area: number }).area).toBe(10000);
  });
  it("未绑的参数不出现", () => {
    const r = resolveInterfaceByParam(interfaces, []);
    expect(r["IP-9"]).toBeUndefined();
  });
  it("link 指向不存在的界面 → 忽略", () => {
    const r = resolveInterfaceByParam(interfaces, [
      { inspectionParameterCode: "IP-1", paramInterfaceCode: "ghost" },
    ]);
    expect(r["IP-1"]).toBeUndefined();
  });
});

describe("resolveInterfaceByParam 作用域特异性（第二波裁定）", () => {
  const ifaces = [
    { code: "weld", version: 1 },
    { code: "mech", version: 1, config: { formulaKey: "tensile_strength" } },
    {
      code: "conn",
      version: 1,
      config: { formulaKey: "tensile_strength", connection: true },
    },
  ] as never[];
  const links = [
    { inspectionParameterCode: "IP-0087", paramInterfaceCode: "weld" }, // 通用（无作用域）= 焊接兜底
    {
      inspectionParameterCode: "IP-0087",
      paramInterfaceCode: "mech",
      reportNameCode: "RN-102-1",
    },
    {
      inspectionParameterCode: "IP-0087",
      paramInterfaceCode: "conn",
      reportNameCode: "RN-102-2",
    },
  ];
  it("reportNameCode 命中(RN-102-1) → 力学界面", () => {
    const r = resolveInterfaceByParam(ifaces, links, "RN-102-1");
    expect(r["IP-0087"]!.interfaceCode).toBe("mech");
    expect((r["IP-0087"]!.config as { connection?: boolean }).connection).toBeUndefined();
  });
  it("reportNameCode 命中(RN-102-2) → 连接界面", () => {
    const r = resolveInterfaceByParam(ifaces, links, "RN-102-2");
    expect((r["IP-0087"]!.config as { connection?: boolean }).connection).toBe(true);
  });
  it("焊接报告(RN-102-3) 无作用域命中 → 退回通用兜底", () => {
    const r = resolveInterfaceByParam(ifaces, links, "RN-102-3");
    expect(r["IP-0087"]!.interfaceCode).toBe("weld");
  });
  it("无 categoryCode → 退回通用关联", () => {
    const r = resolveInterfaceByParam(ifaces, links);
    expect(r["IP-0087"]!.interfaceCode).toBe("weld");
  });

  it("inspectionStandardCode 精确命中 > reportNameCode > 通用", () => {
    const ifaces2 = [
      { code: "generic", version: 1, config: { tier: "generic" } },
      { code: "by-report", version: 1, config: { tier: "report" } },
      { code: "by-std", version: 1, config: { tier: "std" } },
    ] as never[];
    const links2 = [
      { inspectionParameterCode: "IP-9", paramInterfaceCode: "generic" },
      {
        inspectionParameterCode: "IP-9",
        paramInterfaceCode: "by-report",
        reportNameCode: "RN-1",
      },
      {
        inspectionParameterCode: "IP-9",
        paramInterfaceCode: "by-std",
        inspectionStandardCode: "STD-A",
      },
    ];
    const r = resolveInterfaceByParam(ifaces2, links2, "RN-1", "STD-A");
    expect((r["IP-9"]!.config as { tier: string }).tier).toBe("std");
    // 只给报告作用域 → report 命中
    const r2 = resolveInterfaceByParam(ifaces2, links2, "RN-1");
    expect((r2["IP-9"]!.config as { tier: string }).tier).toBe("report");
    // 都不命中 → 通用兜底
    const r3 = resolveInterfaceByParam(ifaces2, links2, "RN-X");
    expect((r3["IP-9"]!.config as { tier: string }).tier).toBe("generic");
  });
});
