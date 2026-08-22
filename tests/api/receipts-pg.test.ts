// tests/api/receipts-pg.test.ts — 直调 db-queries（不经 HTTP），对 lab_dev 断言。
// 前置：npm run seed:db。pg 不可达时整组 skip（模式同 db.smoke.test.ts）。
// CI（fresh lab_test）无种子数据 → 整组 skip。
// DATABASE_URL 的引导在 tests/setup.ts（静态 import 被提升，本文件里设 env 太晚）。
import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { listReceiptsDb, getReceiptDb, applyFlowActionDb, TENANT } from "@/lib/db-queries";

// CI 默认无种子数据,local dev 有;env 检测决定是否跑
const isCi = process.env.CI === "true" || !!process.env.GITHUB_ACTIONS;
const skipReason = isCi ? "CI fresh postgres 无种子数据,seed 阶段不在 CI 跑" : undefined;

const hasPg = (() => {
  try {
    const req = createRequire(resolve(process.cwd(), "package.json"));
    req("postgres");
    return true;
  } catch {
    return false;
  }
})();

// flowHistory jsonb 元素的最小形状（db-queries 侧类型是 unknown[]）
interface FlowHistoryEntry {
  action: string;
  from?: string;
  to?: string;
  operator?: string;
}

// CI 无种子数据,直接 describe.skipIf 在注册时跳过整块。
// hasPg 仍是动态探测(vitest module 加载期 try pg),保留 beforeAll 兜底。
describe.skipIf(skipReason !== undefined)("receipts 三态流转（pg）", () => {
  beforeAll(function (this: { skip(): void } & Record<string, unknown>) {
    if (!hasPg) this.skip();
  });

  it("not_yet: 停在 receiving 的单据", async () => {
    const r = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 20 });
    expect(r.total).toBeGreaterThan(0);
    for (const it of r.items) expect(it.flowStatus).toBe("receiving");
  });
  it("submitted: 已从 receiving 提交走的单据", async () => {
    const r = await listReceiptsDb({ filter: "submitted", flowStatus: "receiving", page: 1, pageSize: 20 });
    expect(r.total).toBeGreaterThan(0);
    for (const it of r.items) {
      expect(it.flowStatus).not.toBe("receiving");
      expect((it.flowHistory as FlowHistoryEntry[]).some((h) => h.action === "submit" && h.from === "receiving")).toBe(true);
    }
  });
  it("flowStatus 直滤 + tenant 隔离", async () => {
    const r = await listReceiptsDb({ flowStatus: "review", page: 1, pageSize: 1000 });
    expect(r.total).toBeGreaterThan(0);
    for (const it of r.items) {
      expect(it.flowStatus).toBe("review");
      expect(it.tenantId).toBe(TENANT);
    }
  });
  it("applyFlowActionDb: submit 前进一阶并 append history", async () => {
    const list = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 1 });
    const id = String(list.items[0]!.id);
    const res = await applyFlowActionDb(id, "submit", "tester");
    expect(res.ok).toBe(true);
    const after = await getReceiptDb(id);
    expect(after!.flowStatus).toBe("task_assignment");
    expect(after!.lastSubmittedBy).toBe("tester");
    const hist = after!.flowHistory as FlowHistoryEntry[];
    expect(hist[hist.length - 1]!.action).toBe("submit");
    // 还原（撤回 = 回退 + 清 lastSubmittedBy）
    await applyFlowActionDb(id, "withdraw", "tester");
  });
  it("withdraw 仅限本人", async () => {
    const list = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 1 });
    const id = String(list.items[0]!.id);
    const res = await applyFlowActionDb(id, "withdraw", "someone-else");
    expect(res.ok).toBe(false);
  });
  it("return 不清空 lastSubmittedBy，withdraw 还原", async () => {
    const list = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 1 });
    const id = String(list.items[0]!.id);
    // submit ×2 → receiving → data_entry，记录提交人
    const s1 = await applyFlowActionDb(id, "submit", "tester");
    expect(s1.ok).toBe(true);
    const s2 = await applyFlowActionDb(id, "submit", "tester");
    expect(s2.ok).toBe(true);
    let after = await getReceiptDb(id);
    expect(after!.flowStatus).toBe("data_entry");
    expect(after!.lastSubmittedBy).toBe("tester");
    // return → 后退一阶（data_entry → task_assignment），lastSubmittedBy 保持不变（不清空）
    const ret = await applyFlowActionDb(id, "return", "reviewer", "材料不齐");
    expect(ret.ok).toBe(true);
    if (ret.ok) expect(ret.flowStatus).toBe("task_assignment");
    after = await getReceiptDb(id);
    expect(after!.lastSubmittedBy).toBe("tester");
    const hist = after!.flowHistory as FlowHistoryEntry[];
    expect(hist[hist.length - 1]!.action).toBe("return");
    // withdraw → 后退一阶 + 清 lastSubmittedBy，还原数据（回到 receiving）
    const w = await applyFlowActionDb(id, "withdraw", "tester");
    expect(w.ok).toBe(true);
    after = await getReceiptDb(id);
    expect(after!.lastSubmittedBy).toBeNull();
    expect(after!.flowStatus).toBe("receiving");
  });
});
