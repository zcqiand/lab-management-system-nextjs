// tests/api/contracts-pg.test.ts — contracts 域 db-queries 直调（lab_test，ADR-0020 真库硬依赖）。
//
// BFF 全域 token 化（2026-09-23）回归锚点：contracts 域 5 函数显式 tenantId 参数，
// 跨租户不可见。背景：lab_dev 的 SSO 数据面桥（seed-db.ts）把合同镜像成
// TENANT-001 + SSO UUID 两个世界；本域此前完全无租户过滤（T11 d15f9e5 起的缺口），
// SSO 用户全量看到两个世界 = 「nextjs 6 条、react/vue 3 条」报障根因。
// 自播种子 marker `__contracts_pg_test_`，afterAll 清。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import {
  listContractsDb,
  getContractDb,
  createContractDb,
  updateContractDb,
  deleteContractDb,
} from "@/lib/db-queries";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_test";

const MARKER = "__contracts_pg_test_";
const TENANT_DEMO = "TENANT-001";
const TENANT_SSO = "00000000-0000-0000-0000-000000000001";
const ID_DEMO = `${MARKER}demo-001`;
const ID_SSO = `${MARKER}sso-001`;

let sql: ReturnType<typeof postgres> | null = null;

async function connect(): Promise<ReturnType<typeof postgres>> {
  if (sql) return sql;
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

async function cleanup(s: ReturnType<typeof postgres>) {
  await s`delete from contracts where id like ${MARKER + "%"}`;
}

async function seed(s: ReturnType<typeof postgres>) {
  await cleanup(s);
  for (const [id, tenant] of [
    [ID_DEMO, TENANT_DEMO],
    [ID_SSO, TENANT_SSO],
  ] as const) {
    await s`insert into contracts (
      id, tenant_id, contract_code, client_unit, project_name, construction_unit,
      witness_unit, witness, status, created_at, updated_at
    ) values (
      ${id}, ${tenant}, ${MARKER + tenant}, ${"委托单位"}, ${"项目"},
      ${"施工单位"}, ${"见证单位"}, ${"见证人"}, ${"active"},
      ${"2026-09-23T00:00:00Z"}, ${"2026-09-23T00:00:00Z"}
    )`;
  }
}

// 90s 同 dict-pg/receipts-pg：Tailscale 远端库逐查询 RTT 偏高
describe("contracts 域 token 租户隔离（pg, lab_test）", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    await seed(await connect());
  });
  afterAll(async () => {
    if (sql) await cleanup(sql);
    await disconnect();
  });

  it("list：TENANT-001 只见本租户行（不见 SSO 世界）", async () => {
    const r = await listContractsDb(TENANT_DEMO, { keyword: MARKER });
    expect(r.length).toBe(1);
    expect(r[0]!.id).toBe(ID_DEMO);
  });

  it("list：SSO UUID 租户只见 SSO 世界行（报障「6 条重复」的回归锚点）", async () => {
    const r = await listContractsDb(TENANT_SSO, { keyword: MARKER });
    expect(r.length).toBe(1);
    expect(r[0]!.id).toBe(ID_SSO);
  });

  it("get：他租户 id 不可见", async () => {
    // not-found 契约 = null（T11 起本域 Row | null，与 receipts 域 undefined 不同形）
    expect(await getContractDb(TENANT_DEMO, ID_SSO)).toBeNull();
    expect(await getContractDb(TENANT_SSO, ID_DEMO)).toBeNull();
    expect((await getContractDb(TENANT_DEMO, ID_DEMO))!.id).toBe(ID_DEMO);
  });

  it("create：tenantId 取显式参数，不信 dto 携带值", async () => {
    const row = await createContractDb(TENANT_SSO, {
      id: `${MARKER}create-001`,
      tenantId: TENANT_DEMO,
      contractCode: `${MARKER}create`,
      clientUnit: "c",
      projectName: "p",
      constructionUnit: "b",
      witnessUnit: "w",
      witness: "w",
      status: "active",
      createdAt: "2026-09-23T00:00:00Z",
      updatedAt: "2026-09-23T00:00:00Z",
    });
    expect(row.tenantId).toBe(TENANT_SSO);
    expect(await getContractDb(TENANT_DEMO, `${MARKER}create-001`)).toBeNull();
  });

  it("update / delete：他租户 id 不可改不可删", async () => {
    expect(
      await updateContractDb(TENANT_DEMO, ID_SSO, { projectName: "hacked" }),
    ).toBeNull();
    expect(await deleteContractDb(TENANT_DEMO, ID_SSO)).toBe(false);
    expect((await getContractDb(TENANT_SSO, ID_SSO))!.projectName).toBe("项目");
    expect(
      await updateContractDb(TENANT_SSO, ID_SSO, { projectName: "改了" }),
    ).not.toBeNull();
    expect(await deleteContractDb(TENANT_SSO, ID_SSO)).toBe(true);
  });
});
