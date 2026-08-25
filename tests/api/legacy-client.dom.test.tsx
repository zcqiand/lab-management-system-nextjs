import { expect, test } from "vitest";
import { apiClient, API_ROUTES } from "@/api/legacy-client";

// CI 没起 msw/BFF,这些端点集成测试需要 server。CI 跳过,local dev 跑。
const isCi = process.env.CI === "true" || !!process.env.GITHUB_ACTIONS;

// REF UI 依赖的列表端点在 lab-msw 全部可达（M1 映射的集成冒烟）。
// 失败 = msw 仓缺 handler，先修 msw 再继续移植。
test.skipIf(isCi)("API_ROUTES 映射的列表端点全部可达", async () => {
  const gets = [
    "/inspection-calculation-methods", "/inspection-objects", "/inspection-parameters",
    "/inspection-standards", "/inspection-technical-requirements", "/inspection-param-interfaces",
    "/report-names", "/receipts", "/samples", "/test-records", "/summary",
  ] as const;
  for (const legacy of gets) {
    const res = await apiClient.get(API_ROUTES[legacy]);
    expect(res.status).toBe(200);
  }
});

// 4 条 link 路由（msw 仓已补 GET handler）：带过滤参数各取一个种子 code，
// 断言 200 + 数组形状 + 过滤字段全部命中。
test.skipIf(isCi)("API_ROUTES 映射的 link 端点全部可达", async () => {
  const cases = [
    {
      legacy: "/inspection-standard-parameters",
      // 契约 query 参数是 inspectionStandardCode（shared tsp），旧测试写 standardCode
      // 被 msw handler 忽略 → 返回全量 508 条 → 过滤断言失败（2026-08-25 修）
      query: "?inspectionStandardCode=GB%20175-2023",
      field: "inspectionStandardCode",
      value: "GB 175-2023",
    },
    {
      legacy: "/inspection-report-name-standards",
      query: "?reportNameCode=RN-101",
      field: "reportNameCode",
      value: "RN-101",
    },
    {
      legacy: "/inspection-report-name-parameters",
      query: "?reportNameCode=RN-101",
      field: "reportNameCode",
      value: "RN-101",
    },
    {
      legacy: "/inspection-parameter-param-interfaces",
      query: "?parameterCode=IP-0055",
      field: "inspectionParameterCode",
      value: "IP-0055",
    },
  ] as const;
  for (const { legacy, query, field, value } of cases) {
    const res = await apiClient.get(API_ROUTES[legacy] + query);
    expect(res.status).toBe(200);
    // msw 2026-08-24 起返回 {items,page,pageSize,total} 分页包（原裸数组已废）；
    // 兼容两形状：分页包取 items，裸数组直接用。
    const rows = Array.isArray(res.data)
      ? res.data
      : ((res.data as { items?: unknown[] }).items ?? []);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((l: Record<string, string>) => l[field] === value)).toBe(true);
  }
});
