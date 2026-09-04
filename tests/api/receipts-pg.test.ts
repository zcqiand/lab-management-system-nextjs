// tests/api/receipts-pg.test.ts — 直调 db-queries（不经 HTTP），对 lab_test 断言。
// 2026-09-04 ADR-0020 family-wide 真库硬依赖：连不上即失败，不 skip。
// 自播种子：marker 前缀 `__receipts_pg_test_`（commission_code），afterAll 清。
// 不走 seed-db.ts —— TRUNCATE 破坏性，不适合共享 lab_test 仓。
//
// 家族模式：与 lab-springboot RepositoryPgTest / saas-springboot RepositoryPgTest
// 同款（真方言 + inline 种子 + 显式 cleanup，无 in-memory fallback）。
//
// CI 分层：family-wide 约定「CI 编译 / gate 真库」—— vitest 4 projects
// 不能按文件名 exclude；用 describe.skipIf 仍属 "test code skip"（用户禁）。
// 改在 CI workflow 里用 --testFile 全集里 exclude（不读家族分层的 test code skipIf）。
// 本文件本身不再 skip，由 CI workflow 决定是否跑。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { listReceiptsDb, getReceiptDb, applyFlowActionDb, TENANT } from "@/lib/db-queries";

// postgres-js 是仓 dependencies（不是 devDep），缺包即 module-load 失败，
// 无需运行时 hasPg 探测 —— 与 db.smoke.test.ts 的 devDep pg 探测不是同一回事。
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_test";

// 自播种子 marker：commission_code 前缀。afterAll 按前缀 DELETE 整批清理。
const TEST_MARKER = "__receipts_pg_test_";

// 种子 contract（FK 依赖；id 唯一避免与 msw fixture 冲突）
const TEST_CONTRACT_ID = "test-contract-receipts-pg";
const SEEDED_RECEIVING_ID = "test-receipt-receiving-001";
const SEEDED_REVIEW_ID = "test-receipt-review-001";
const SEEDED_SUBMITTED_ID = "test-receipt-submitted-001";

let sql: ReturnType<typeof postgres> | null = null;

// --- 工具：直连 + 显式 requireReachable ---
async function connect(): Promise<ReturnType<typeof postgres>> {
  if (sql) return sql;
  // postgres-js 立刻建连；连不上 → throw（fail-loud, no fallback）。
  // connect_timeout 单位秒；onnotice 关掉迁移 NOTICE 噪音。
  sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  await sql`select 1 as ok`;
  return sql;
}

async function disconnect() {
  if (sql) {
    await sql.end({ timeout: 1 });
    sql = null;
  }
}

async function cleanupTestRows(s: ReturnType<typeof postgres>) {
  await s`delete from sample_receipts where commission_code like ${TEST_MARKER + "%"}`;
  await s`delete from contracts where id = ${TEST_CONTRACT_ID}`;
}

async function seedFixture(s: ReturnType<typeof postgres>) {
  await cleanupTestRows(s);
  // contract（NOT NULL: contract_code / client_unit / project_name / construction_unit /
  // witness_unit / witness / status / created_at / updated_at）
  await s`insert into contracts (
    id, contract_code, client_unit, project_name, construction_unit,
    witness_unit, witness, status, created_at, updated_at
  ) values (
    ${TEST_CONTRACT_ID}, ${TEST_MARKER + "contract-001"},
    ${"PG 测试委托单位"}, ${"PG 测试项目"}, ${"PG 测试施工单位"},
    ${"PG 测试见证单位"}, ${"PG 测试见证人"}, ${"active"},
    ${"2026-09-04T00:00:00Z"}, ${"2026-09-04T00:00:00Z"}
  )`;
  // receiving 种子（flow_status=receiving, flow_history=[], lastSubmittedBy=null）
  await s`insert into sample_receipts (
    id, tenant_id, contract_id, commission_code, commission_date, category_code,
    received_by, sample_source, test_category, flow_status, flow_history,
    last_submitted_by, created_at, updated_at
  ) values (
    ${SEEDED_RECEIVING_ID}, ${TENANT}, ${TEST_CONTRACT_ID},
    ${TEST_MARKER + "receiving-001"}, ${"2026-09-04"}, ${"CAT-SMK-001"},
    ${"pg-tester"}, ${"现场抽样"}, ${"常规检测"}, ${"receiving"}, ${s.json([])},
    ${null}, ${"2026-09-04T00:00:00Z"}, ${"2026-09-04T00:00:00Z"}
  )`;
  // review 种子（flow_status=review, flow_history 含 submit×3 from receiving/task_assignment/data_entry, lastSubmittedBy=tester）
  // postgres-js 自动序列化 JS 数组 → jsonb：直接传 JS 对象数组，不要 JSON.stringify
  // （seed-db.ts L200-211 同款教训：tagged 模板里 ${string}::jsonb 会被 postgres-js
  // 当 unknown literal 包装 → "cannot extract elements from a scalar"）。
  const reviewHistory = [
    { action: "submit", from: "receiving", to: "task_assignment", operator: "tester", at: "2026-09-04T01:00:00Z" },
    { action: "submit", from: "task_assignment", to: "data_entry", operator: "tester", at: "2026-09-04T02:00:00Z" },
    { action: "submit", from: "data_entry", to: "review", operator: "tester", at: "2026-09-04T03:00:00Z" },
  ];
  await s`insert into sample_receipts (
    id, tenant_id, contract_id, commission_code, commission_date, category_code,
    received_by, sample_source, test_category, flow_status, flow_history,
    last_submitted_by, created_at, updated_at
  ) values (
    ${SEEDED_REVIEW_ID}, ${TENANT}, ${TEST_CONTRACT_ID},
    ${TEST_MARKER + "review-001"}, ${"2026-09-04"}, ${"CAT-SMK-001"},
    ${"pg-tester"}, ${"现场抽样"}, ${"常规检测"}, ${"review"}, ${s.json(reviewHistory)},
    ${"tester"}, ${"2026-09-04T00:00:00Z"}, ${"2026-09-04T03:00:00Z"}
  )`;
  // submitted 种子（已从 receiving submit 走，但当前不在 receiving；history 有 submit from receiving）
  const submittedHistory = [
    { action: "submit", from: "receiving", to: "task_assignment", operator: "tester", at: "2026-09-04T01:00:00Z" },
  ];
  await s`insert into sample_receipts (
    id, tenant_id, contract_id, commission_code, commission_date, category_code,
    received_by, sample_source, test_category, flow_status, flow_history,
    last_submitted_by, created_at, updated_at
  ) values (
    ${SEEDED_SUBMITTED_ID}, ${TENANT}, ${TEST_CONTRACT_ID},
    ${TEST_MARKER + "submitted-001"}, ${"2026-09-04"}, ${"CAT-SMK-001"},
    ${"pg-tester"}, ${"现场抽样"}, ${"常规检测"}, ${"task_assignment"}, ${s.json(submittedHistory)},
    ${"tester"}, ${"2026-09-04T00:00:00Z"}, ${"2026-09-04T01:00:00Z"}
  )`;
}

// flowHistory jsonb 元素的最小形状（db-queries 侧类型是 unknown[]）
interface FlowHistoryEntry {
  action: string;
  from?: string;
  to?: string;
  operator?: string;
}

// family-wide：requireReachable 即接即测，连不上 throw（fail-loud, no fallback）。
// 家族约定「CI 编译+mock / gate 真库」—— CI workflow 用 --exclude 决定是否跑本文件。
describe("receipts 三态流转（pg, lab_test, requireReachable）", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    const s = await connect();
    await seedFixture(s);
  });

  afterAll(async () => {
    if (sql) await cleanupTestRows(sql);
    await disconnect();
  });

  it("not_yet: 停在 receiving 的单据", async () => {
    const r = await listReceiptsDb({ filter: "not_yet", flowStatus: "receiving", page: 1, pageSize: 20 });
    // 至少包含我们种子的 receiving 行；可能有 msw fixture 历史残留（CI 不跑 seed）
    expect(r.total).toBeGreaterThanOrEqual(1);
    const seeded = r.items.find((it) => it.id === SEEDED_RECEIVING_ID);
    expect(seeded).toBeDefined();
    expect(seeded!.flowStatus).toBe("receiving");
  });

  it("submitted: 已从 receiving 提交走的单据", async () => {
    const r = await listReceiptsDb({ filter: "submitted", flowStatus: "receiving", page: 1, pageSize: 20 });
    expect(r.total).toBeGreaterThanOrEqual(1);
    const seeded = r.items.find((it) => it.id === SEEDED_SUBMITTED_ID);
    expect(seeded).toBeDefined();
    expect(seeded!.flowStatus).not.toBe("receiving");
    expect(
      (seeded!.flowHistory as FlowHistoryEntry[]).some(
        (h) => h.action === "submit" && h.from === "receiving",
      ),
    ).toBe(true);
  });

  it("flowStatus 直滤 + tenant 隔离", async () => {
    const r = await listReceiptsDb({ flowStatus: "review", page: 1, pageSize: 1000 });
    expect(r.total).toBeGreaterThanOrEqual(1);
    for (const it of r.items) {
      expect(it.flowStatus).toBe("review");
      expect(it.tenantId).toBe(TENANT);
    }
  });

  it("applyFlowActionDb: submit 前进一阶并 append history", async () => {
    const res = await applyFlowActionDb(SEEDED_RECEIVING_ID, "submit", "tester");
    expect(res.ok).toBe(true);
    const after = await getReceiptDb(SEEDED_RECEIVING_ID);
    expect(after!.flowStatus).toBe("task_assignment");
    expect(after!.lastSubmittedBy).toBe("tester");
    const hist = after!.flowHistory as FlowHistoryEntry[];
    expect(hist[hist.length - 1]!.action).toBe("submit");
    // 还原（撤回 = 回退 + 清 lastSubmittedBy）
    await applyFlowActionDb(SEEDED_RECEIVING_ID, "withdraw", "tester");
  });

  it("withdraw 仅限本人", async () => {
    const res = await applyFlowActionDb(SEEDED_RECEIVING_ID, "withdraw", "someone-else");
    // seed 后状态 = receiving, lastSubmittedBy=null，所以 someone-else 不匹配 → ok:false
    expect(res.ok).toBe(false);
  });

  it("return 不清空 lastSubmittedBy，withdraw 还原", async () => {
    // submit ×2 → receiving → data_entry，记录提交人
    const s1 = await applyFlowActionDb(SEEDED_RECEIVING_ID, "submit", "tester");
    expect(s1.ok).toBe(true);
    const s2 = await applyFlowActionDb(SEEDED_RECEIVING_ID, "submit", "tester");
    expect(s2.ok).toBe(true);
    let after = await getReceiptDb(SEEDED_RECEIVING_ID);
    expect(after!.flowStatus).toBe("data_entry");
    expect(after!.lastSubmittedBy).toBe("tester");
    // return → 后退一阶（data_entry → task_assignment），lastSubmittedBy 保持不变（不清空）
    const ret = await applyFlowActionDb(SEEDED_RECEIVING_ID, "return", "reviewer", "材料不齐");
    expect(ret.ok).toBe(true);
    if (ret.ok) expect(ret.flowStatus).toBe("task_assignment");
    after = await getReceiptDb(SEEDED_RECEIVING_ID);
    expect(after!.lastSubmittedBy).toBe("tester");
    const hist = after!.flowHistory as FlowHistoryEntry[];
    expect(hist[hist.length - 1]!.action).toBe("return");
    // withdraw → 后退一阶 + 清 lastSubmittedBy，还原数据（回到 receiving）
    const w = await applyFlowActionDb(SEEDED_RECEIVING_ID, "withdraw", "tester");
    expect(w.ok).toBe(true);
    after = await getReceiptDb(SEEDED_RECEIVING_ID);
    expect(after!.lastSubmittedBy).toBeNull();
    expect(after!.flowStatus).toBe("receiving");
  });
});
