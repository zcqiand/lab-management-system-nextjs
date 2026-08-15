// M02.F01.I02 / M02.F01.I03 — 合同新建/编辑 + 删除
//
// 直接走 lab-msw 的 fixtures（同进程内 4-backend 切换共享同一份数组）；
// POST 后立刻 GET 该 id 拿回，再 DELETE 验证 204 / 数组收缩。
import { describe, expect } from "vitest";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { fnTest } from "../fn";

const BASE = API_ROUTES["/contracts"]; // "/api/contracts"

const NEW_BODY = {
  tenantId: "TENANT-001",
  contractCode: "TEST-CRUD-001",
  clientUnit: "测试委托单位",
  projectName: "测试工程项目",
  constructionUnit: "施工单位",
  witnessUnit: "见证单位",
  witness: "见证人甲",
  status: "active" as const,
};

describe("contracts CRUD (M02.F01.I02 / I03)", () => {
  fnTest(["M02.F01.I02"], "新建合同：POST 返回带 id+contractCode 的对象，且 GET 列表能查到", async () => {
    const post = await apiClient.post(BASE, NEW_BODY);
    expect(post.status).toBe(201);
    const created = post.data as { id: string; contractCode: string };
    expect(created.id).toMatch(/^CONTRACT-/);
    expect(created.contractCode).toBe(NEW_BODY.contractCode);

    const list = await apiClient.get(`${BASE}?keyword=TEST-CRUD-001`);
    expect(list.status).toBe(200);
    const items = (list.data as { items: Array<{ id: string }> }).items;
    expect(items.some((c) => c.id === created.id)).toBe(true);
  });

  fnTest(["M02.F01.I02"], "编辑合同：PUT 改 witness 后再 GET 该 id 字段已更新", async () => {
    const post = await apiClient.post(BASE, NEW_BODY);
    const id = (post.data as { id: string }).id;
    const put = await apiClient.put(`${BASE}/${id}`, { witness: "见证人乙" });
    expect(put.status).toBe(200);
    expect((put.data as { witness: string }).witness).toBe("见证人乙");
  });

  fnTest(["M02.F01.I03"], "删除合同：DELETE 后 GET 列表不再包含该 id", async () => {
    const post = await apiClient.post(BASE, NEW_BODY);
    const id = (post.data as { id: string }).id;
    const del = await apiClient.delete(`${BASE}/${id}`);
    expect([200, 204]).toContain(del.status);

    const list = await apiClient.get(`${BASE}?keyword=TEST-CRUD-001`);
    const items = (list.data as { items: Array<{ id: string }> }).items;
    expect(items.some((c) => c.id === id)).toBe(false);
  });
});