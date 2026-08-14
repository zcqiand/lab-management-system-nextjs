import { expect, test } from "vitest";
import { apiClient, API_ROUTES } from "@/api/legacy-client";

// REF UI 依赖的列表端点在 lab-msw 全部可达（M1 映射的集成冒烟）。
// 失败 = msw 仓缺 handler，先修 msw 再继续移植。
test("API_ROUTES 映射的列表端点全部可达", async () => {
  const gets = [
    "/inspection-calculation-rules", "/inspection-objects", "/inspection-parameters",
    "/inspection-standards", "/inspection-technical-requirements", "/param-interfaces",
    "/report-names", "/receipts", "/samples", "/test-records", "/summary",
  ] as const;
  for (const legacy of gets) {
    const res = await apiClient.get(API_ROUTES[legacy]);
    expect(res.status).toBe(200);
  }
});

// BLOCKED（msw 仓，非本任务修改范围）：以下 4 条 link 路由在 lab-msw 只有
// POST/DELETE handler，shared/generated/openapi/openapi.yaml 同样没有 GET 操作；
// 且 GET /api/param-interfaces/links 实测被先注册的 GET /api/param-interfaces/:code
// 吞掉（404 {"message":"ParamInterface not found"}）。msw 仓补 GET handler
// （必须注册在 :code 之前，msw 按注册顺序匹配）后，把 4 个键挪进上面的 gets。
test.todo("API_ROUTES 映射的 link 端点全部可达（待 msw 仓补 GET handler）: " +
  "/inspection-parameter-param-interfaces, /inspection-report-name-parameters, " +
  "/inspection-report-name-standards, /inspection-standard-parameters");
