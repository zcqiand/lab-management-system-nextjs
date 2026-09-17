// M03.F03.I08 / M03.F03.I09 — 检测记录列表 / 创建 API fnTest（清「已上线但无测试引用」软告警）。
//
// 直接 import 路由 handler + 构造 Request（同 m98-wiring 模式，不动 nextjs dev server）。
// fixtures 是 lab-msw in-memory 数组：POST 后立刻 GET 断言可见，不留脏数据（测完 pop）。
import { describe, expect } from "vitest";
import { GET, POST } from "@/app/api/test-records/route";
import { fnTest } from "../fn";

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("test-records API (M03.F03.I08 / I09)", () => {
  fnTest(["M03.F03.I08"], "GET /api/test-records 按 sampleId 过滤 + 分页结构 {items,page,pageSize,total}", async () => {
    // 借 fixtures 既有种子：任取一条真实 sampleId 保证非空过滤命中
    const anyList = await GET(req("http://test/api/test-records"));
    expect(anyList.status).toBe(200);
    const seeded = ((await anyList.json()) as { items: Array<{ sampleId: string }> }).items;
    expect(seeded.length).toBeGreaterThan(0);
    const sampleId = seeded[0]!.sampleId;

    const res = await GET(req(`http://test/api/test-records?sampleId=${encodeURIComponent(sampleId)}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ sampleId: string }>;
      page: number;
      pageSize: number;
      total: number;
    };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((t) => t.sampleId === sampleId)).toBe(true);
    expect(body.total).toBe(body.items.length);
    expect(body.page).toBe(1);
  });

  fnTest(["M03.F03.I09"], "POST /api/test-records 创建后返回 201 带 TR- 前缀 id，GET 立即可见；清理不留种子", async () => {
    const res = await POST(
      req("http://test/api/test-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sampleId: "SAMPLE-SEED-001",
          parameterCode: "PARAM-TEST-TEMP",
          requirement: "≥42.5",
          result: "48.2",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; sampleId: string };
    expect(created.id).toMatch(/^TR-/);
    expect(created.sampleId).toBe("SAMPLE-SEED-001");

    const after = await GET(
      req(`http://test/api/test-records?sampleId=SAMPLE-SEED-001`),
    );
    const afterBody = (await after.json()) as { items: Array<{ id: string }>; total: number };
    expect(afterBody.items.some((t) => t.id === created.id)).toBe(true);
    // total 是过滤后条数：全新 sampleId 下应恰好只有刚创建的这 1 条
    expect(afterBody.total).toBe(1);

    // 清理：in-memory fixtures 是跨测试共享的，pop 掉本条避免污染其他测试
    const { testRecords } = await import("@lab/management-system-msw/fixtures");
    const idx = testRecords.findIndex((t) => t.id === created.id);
    if (idx >= 0) testRecords.splice(idx, 1);
  });
});
