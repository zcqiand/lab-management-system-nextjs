// tests/api/dict-pg.test.ts — dict/catalog 域直调 db-queries（不经 HTTP），对 lab_test 断言。
// Batch1：16 条 dict+catalog 路由从 msw fixture 数组接真库后的行为锚点。
// 自播种子：marker 前缀 `__dict_pg_test_`（code 列），afterAll 按前缀清。
// 契约语义真相源 = src/lib/api-helpers.ts wrapDict / src/lib/catalog-handlers.ts
// fixture 版（POST 重复 400 文案、junction 反查链、聚合列 '，' join、id=code）。
//
// CI 分层：与 receipts-pg.test.ts 同款——本文件不 skip，由 CI workflow
// VITEST_SKIP_PG=1 按 glob tests/api/*-pg.test.ts 决定是否跑（vitest.config.ts）。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import {
  listDictDb,
  getDictDb,
  createDictDb,
  putDictDb,
  deleteDictDb,
  DICT_CFGS,
  CATALOG_CFGS,
} from "@/lib/db-queries";

// BFF 全域 token 化（2026-09-23）：tenantId 改为显式参数，db-map 的 TENANT 已删。
const TENANT = "TENANT-001";
const TENANT_OTHER = "TENANT-OTHER";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_test";

// 自播种子 marker：code 前缀。afterAll 按前缀 DELETE 整批清理。
const MARKER = "__dict_pg_test_";

// 种子码位（FK 拓扑：专项→项目→参数/标准）
const SP = `${MARKER}SP`;
const OBJ = `${MARKER}OBJ`;
const IP_A = `${MARKER}IP-A`;
const IP_B = `${MARKER}IP-B`;
const IP_C = `${MARKER}IP-C`; // 无任何 junction 链接的对照参数
const STD = `${MARKER}STD`;
const BRAND_TENANT = `${MARKER}BR-T`;
const BRAND_OTHER = `${MARKER}BR-OTHER`;
const NOW_STAMP = "2026-09-13T00:00:00Z";

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

async function cleanupTestRows(s: ReturnType<typeof postgres>) {
  // children → parents
  await s`delete from inspection_standard_parameters where inspection_standard_code = ${STD} or inspection_parameter_code like ${MARKER + "%"}`;
  await s`delete from inspection_object_standards where inspection_object_code = ${OBJ} or inspection_standard_code = ${STD}`;
  await s`delete from inspection_object_parameters where inspection_object_code = ${OBJ} or inspection_parameter_code like ${MARKER + "%"}`;
  await s`delete from inspection_specialty_objects where inspection_specialty_code = ${SP} or inspection_object_code = ${OBJ}`;
  await s`delete from inspection_brands where code like ${MARKER + "%"}`;
  await s`delete from inspection_standards where code like ${MARKER + "%"}`;
  await s`delete from inspection_parameters where code like ${MARKER + "%"}`;
  await s`delete from inspection_objects where code like ${MARKER + "%"}`;
  await s`delete from inspection_specialties where code like ${MARKER + "%"}`;
}

async function seedFixture(s: ReturnType<typeof postgres>) {
  await cleanupTestRows(s);
  await s`insert into inspection_specialties (code, official_no, name, sort_order, created_at, updated_at)
    values (${SP}, ${MARKER + "off"}, ${"PG字典测试专项"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_objects (code, inspection_specialty_code, source_project_no, source_project_name, name, sort_order, created_at, updated_at)
    values (${OBJ}, ${SP}, ${"T"}, ${"PG字典测试项目"}, ${"PG字典测试对象"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_parameters (code, name, raw_name, canonical_name, sort_order, created_at, updated_at)
    values (${IP_A}, ${"PG字典测试参数A"}, ${"A"}, ${"A"}, 9999, ${NOW_STAMP}, ${NOW_STAMP}),
           (${IP_B}, ${"PG字典测试参数B"}, ${"B"}, ${"B"}, 9999, ${NOW_STAMP}, ${NOW_STAMP}),
           (${IP_C}, ${"PG字典测试参数C"}, ${"C"}, ${"C"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_standards (code, name, sort_order, created_at, updated_at)
    values (${STD}, ${"PG字典测试标准"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
  // junction（插入序 = 聚合列 join 序：A 先 B 后）
  await s`insert into inspection_specialty_objects (inspection_specialty_code, inspection_object_code, created_at, updated_at)
    values (${SP}, ${OBJ}, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_object_parameters (inspection_object_code, inspection_parameter_code, created_at, updated_at)
    values (${OBJ}, ${IP_A}, ${NOW_STAMP}, ${NOW_STAMP}),
           (${OBJ}, ${IP_B}, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_object_standards (inspection_object_code, inspection_standard_code, role, created_at, updated_at)
    values (${OBJ}, ${STD}, ${"TESTING"}, ${NOW_STAMP}, ${NOW_STAMP})`;
  await s`insert into inspection_standard_parameters (inspection_standard_code, inspection_parameter_code, created_at, updated_at)
    values (${STD}, ${IP_A}, ${NOW_STAMP}, ${NOW_STAMP})`;
  // catalog tenant 隔离对照：同 marker 前缀、不同 tenant
  await s`insert into inspection_brands (code, name, tenant_id, sort_order, created_at, updated_at)
    values (${BRAND_TENANT}, ${"PG字典测试牌号"}, ${TENANT}, 9999, ${NOW_STAMP}, ${NOW_STAMP}),
           (${BRAND_OTHER}, ${"PG字典测试牌号-他租"}, ${"TENANT-OTHER"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
}

describe(
  "dict/catalog 真库（pg, lab_test, requireReachable）",
  { timeout: 90_000 }, // Tailscale 远端库，逐查询 RTT 偏高
  () => {
    beforeAll(async () => {
      const s = await connect();
      await seedFixture(s);
    });

    afterAll(async () => {
      if (sql) await cleanupTestRows(sql);
      await disconnect();
    });

    it("list all：id=code 补列 + 命中种子行", async () => {
      const r = await listDictDb(TENANT,DICT_CFGS.specialties, {
        page: 1,
        pageSizeParam: "1000",
      });
      expect(r.total).toBeGreaterThanOrEqual(1);
      const seeded = r.items.find((it) => it.code === SP);
      expect(seeded).toBeDefined();
      expect(seeded!.id).toBe(SP); // wrapDict 契约：id = code
      expect(seeded!.name).toBe("PG字典测试专项");
    });

    it("keyword：code/name 字面子串命中", async () => {
      const byCode = await listDictDb(TENANT,DICT_CFGS.specialties, {
        keyword: MARKER,
        page: 1,
        pageSizeParam: undefined,
      });
      // pageSize 缺省 = total（wrapDict items.length || 1 语义）
      expect(byCode.total).toBe(1);
      expect(byCode.pageSize).toBe(1);
      expect(byCode.items[0]!.code).toBe(SP);
      const byName = await listDictDb(TENANT,DICT_CFGS.parameters, {
        keyword: "字典测试参数B",
        page: 1,
      });
      expect(byName.items.some((it) => it.code === IP_B)).toBe(true);
      expect(byName.items.some((it) => it.code === IP_A)).toBe(false);
    });

    it("junction 反查链：fixture wrapDict 同款「存在链接」语义（query 值被忽略）", async () => {
      // 语义真相源：wrapDict 的 reverse 链从不拿 query 值做匹配（allowed 起始为 null，
      // 首跳放行全部 link 行）——过滤语义 = 「该行存在任意 junction 链接」，值仅作触发。
      // golden 已证：params_by_object 旧实现返回 560（所有有链接的参数），不是 19。
      const byObj = await listDictDb(TENANT,DICT_CFGS.parameters, {
        direct: { inspectionObjectCode: OBJ },
        page: 1,
        pageSizeParam: "1000",
      });
      // 有链接者全数通过：IP_A/IP_B 在列；无链接的 IP_C 被排除
      expect(byObj.items.some((it) => it.code === IP_A)).toBe(true);
      expect(byObj.items.some((it) => it.code === IP_B)).toBe(true);
      expect(byObj.items.some((it) => it.code === IP_C)).toBe(false);
      // total = object_parameters 里出现过的不重复参数数（与库内其他对象共享链接集）
      const s = await connect();
      const linked = await s`
        select count(distinct inspection_parameter_code)::int as n from inspection_object_parameters`;
      expect(byObj.total).toBe(linked[0]!.n);
      const bySp = await listDictDb(TENANT,DICT_CFGS.parameters, {
        direct: { inspectionSpecialtyCode: SP },
        page: 1,
      });
      // 两跳链同语义：specialty_objects 里出现过的对象全放行 → 又是「有任意链接」集合
      expect(bySp.items.some((it) => it.code === IP_A)).toBe(true);
      expect(bySp.items.some((it) => it.code === IP_C)).toBe(false);
      const stds = await listDictDb(TENANT,DICT_CFGS.standards, {
        direct: { inspectionObjectCode: OBJ },
        page: 1,
        pageSizeParam: "1000",
      });
      expect(stds.items.some((it) => it.code === STD)).toBe(true);
      const stdLinked = await s`
        select count(distinct inspection_standard_code)::int as n from inspection_object_standards`;
      expect(stds.total).toBe(stdLinked[0]!.n);
    });

    it("聚合列：name 兜底 + '，' join + 去重保序", async () => {
      const objs = await listDictDb(TENANT,DICT_CFGS.objects, { keyword: MARKER, page: 1 });
      expect(objs.items.length).toBe(1);
      expect(objs.items[0]!.parameterNames).toBe("PG字典测试参数A，PG字典测试参数B");
      expect(objs.items[0]!.standardCodes).toBe(STD);
      const params = await listDictDb(TENANT,DICT_CFGS.parameters, { keyword: MARKER, page: 1 });
      const a = params.items.find((it) => it.code === IP_A)!;
      expect(a.objectNames).toBe("PG字典测试对象");
      expect(a.standardCodes).toBe(STD);
    });

    it("catalog：inspectionObjectCode 直列过滤 + tenant 隔离", async () => {
      const r = await listDictDb(TENANT,CATALOG_CFGS.brands, { keyword: MARKER, page: 1 });
      expect(r.items.length).toBe(1); // TENANT-OTHER 行被 tenant 过滤
      expect(r.items[0]!.code).toBe(BRAND_TENANT);
      expect(r.items[0]!.tenantId).toBe(TENANT);
      expect(r.items[0]!.id).toBe(BRAND_TENANT);
      const byObj = await listDictDb(TENANT,CATALOG_CFGS.brands, {
        direct: { inspectionObjectCode: OBJ },
        page: 1,
      });
      expect(byObj.total).toBe(0); // 种子牌号未挂对象
      // 反向视角：TENANT-OTHER 的 token 只见自己世界的行（token 化后 tenantId 显式）
      const other = await listDictDb(TENANT_OTHER,CATALOG_CFGS.brands, {
        keyword: MARKER,
        page: 1,
      });
      expect(other.total).toBe(1);
      expect(other.items[0]!.code).toBe(BRAND_OTHER);
    });

    it("POST：重复 code 返回 fixture 版原句 400 语义；新码创建成功", async () => {
      const dup = await createDictDb(TENANT,DICT_CFGS.specialties, { code: SP, name: "重复" });
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.message).toBe("专项编码已存在");
      const created = await createDictDb(TENANT,DICT_CFGS.specialties, {
        code: `${MARKER}SP-NEW`,
        name: "PG字典测试专项2",
        officialNo: "九",
      });
      expect(created.ok).toBe(true);
      if (created.ok) {
        expect(created.row.code).toBe(`${MARKER}SP-NEW`);
        expect(created.row.name).toBe("PG字典测试专项2");
      }
      const after = await getDictDb(TENANT,DICT_CFGS.specialties, `${MARKER}SP-NEW`);
      expect(after).toBeDefined();
    });

    it("PUT/DELETE roundtrip：body 覆盖 + code 不可改；删后 404 语义", async () => {
      const before = await getDictDb(TENANT,DICT_CFGS.specialties, SP);
      expect(before).toBeDefined();
      const updated = await putDictDb(TENANT,DICT_CFGS.specialties, SP, {
        name: "PG字典测试专项-改",
        code: "HACK-TRY",
      });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe("PG字典测试专项-改");
      expect(updated!.code).toBe(SP); // code 不可改（fixture Object.assign {code: r.code} 语义）
      // updatedAt 被重写为 now（fixture 版 NOW() 语义），晚于种子时间戳
      expect(String(updated!.updatedAt).length).toBeGreaterThan(0);
      expect(updated!.updatedAt).not.toBe(NOW_STAMP);
      // 未知键无列归宿静默丢弃（不炸）
      const withJunk = await putDictDb(TENANT,DICT_CFGS.specialties, SP, { nonExistentCol: 1 });
      expect(withJunk).toBeDefined();
      // DELETE：命中一次，之后未命中（路由层映射 404 "Specialty not found"）
      // 先清掉引用 SP 的子行（objects_specialty_fk），再删 SP
      const s1 = await connect();
      await s1`delete from inspection_standard_parameters where inspection_standard_code = ${STD}`;
      await s1`delete from inspection_object_standards where inspection_object_code = ${OBJ}`;
      await s1`delete from inspection_object_parameters where inspection_object_code = ${OBJ}`;
      await s1`delete from inspection_specialty_objects where inspection_specialty_code = ${SP}`;
      await s1`delete from inspection_objects where code = ${OBJ}`;
      expect(await deleteDictDb(TENANT,DICT_CFGS.specialties, SP)).toBe(true);
      expect(await getDictDb(TENANT,DICT_CFGS.specialties, SP)).toBeUndefined();
      expect(await deleteDictDb(TENANT,DICT_CFGS.specialties, SP)).toBe(false);
      // PUT 不存在的 code → undefined（路由层映射 404）
      expect(await putDictDb(TENANT,DICT_CFGS.specialties, SP, { name: "x" })).toBeUndefined();
      // 还原种子行（其他断言可能复用）
      const s = await connect();
      await s`insert into inspection_specialties (code, official_no, name, sort_order, created_at, updated_at)
        values (${SP}, ${MARKER + "off"}, ${"PG字典测试专项"}, 9999, ${NOW_STAMP}, ${NOW_STAMP})`;
    });
  },
);
