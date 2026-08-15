// tests/helpers/seed.ts —— Task 8（不 commit；Task 9/10 复核后随各自任务收编）
//
// lab-msw（@lab/management-system-msw）与 REF 组件期望的响应形状有两类缺口：
//   1. dictCrud / 链接 GET 返回**裸数组**，REF 组件（axios `.data.items`）期望 `{items:[]}`；
//   2. `/samples` 无 keyword 过滤、`/receipts` 无 categoryCode / lastSubmittedBy 过滤、
//      `/test-records` 无 receiptId 过滤（REF 语义有）。
//
// 本文件提供两层适配（数据仍来自同一内存 fixtures，不是编造 mock）：
//   - `installShapeAdapters(server)`：server.use 高优先级 handler，把上述端点包成
//     REF 形状 `{items,total}` + 补 REF 过滤语义。注意 setup.dom.ts 的 afterEach 会
//     resetHandlers() 清掉 use() 覆盖，所以必须在每个测试文件的 beforeEach 里重装。
//   - `tablesOf()`：把 lab-msw fixtures 的可变数组包成 REF 测试用的 `xxxTable`
//     单例视图（insert/all/findById/reset）。
//
// reset 策略：模块加载时对 fixtures 数组做 structuredClone 快照；`resetFixtures()`
// 用 length=0 + push 恢复（数组引用不变——msw handler 闭包捕获的就是这些引用）。
// 插入行需带 tenantId:'TENANT-001'（msw handler byTenant 过滤，缺 tenantId 的行不可见）。
import { http, HttpResponse } from "msw";
import {
  sampleReceipts,
  samples,
  testRecords,
  inspectionReportNames,
  inspectionParameters,
  inspectionStandards,
  inspectionStandardParameters,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
  paramInterfaces,
  paramInterfaceLinks,
  contracts,
} from "@lab/management-system-msw/fixtures";

// ————————————————————————————————————————————————
// fixtures 快照 / 恢复
// ————————————————————————————————————————————————

const SNAPSHOTTED: Array<{ arr: unknown[]; snapshot: unknown[] }> = [
  sampleReceipts, samples, testRecords, inspectionReportNames, inspectionParameters,
  inspectionStandards, inspectionStandardParameters, inspectionReportNameStandards,
  inspectionReportNameParameters, paramInterfaces, paramInterfaceLinks, contracts,
].map((arr) => ({ arr: arr as unknown[], snapshot: structuredClone(arr) }));

/** 把 fixtures 恢复到模块加载时的快照（引用不变，内容重置）。 */
export function resetFixtures(): void {
  for (const { arr, snapshot } of SNAPSHOTTED) {
    arr.length = 0;
    arr.push(...snapshot);
  }
}

// ————————————————————————————————————————————————
// 形状适配层（server.use 优先级最高；每个 beforeEach 重装）
// ————————————————————————————————————————————————

const TENANT = "TENANT-001";

function pageOf<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
}

function num(v: string | null, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/**
 * 安装 REF 形状适配 handler：
 *  - dictCrud 表（report-names / standards / parameters / param-interfaces）：裸数组 → {items,total}
 *  - 4 条链接 GET：裸数组 → {items,total}（保留过滤参数语义 + role）
 *  - /samples：+ keyword（sampleCode/sampleName includes）
 *  - /receipts：+ categoryCode / lastSubmittedBy
 *  - /test-records：+ receiptId（经 receipt→samples 归集 sampleIds）
 */
export function installShapeAdapters(server: { use: (...h: unknown[]) => void }): void {
  const wrap = (arr: unknown[], request: Request) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      pageOf(arr, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), arr.length || 1)),
    );
  };

  server.use(
    // —— dictCrud 主表（msw 裸数组 → REF {items}）——
    http.get("*/api/report-names", ({ request }) => wrap(inspectionReportNames, request)),
    http.get("*/api/inspection/standards", ({ request }) => wrap(inspectionStandards, request)),
    http.get("*/api/inspection/parameters", ({ request }) => wrap(inspectionParameters, request)),
    http.get("*/api/param-interfaces", ({ request }) => wrap(paramInterfaces, request)),

    // —— 链接 GET（msw 裸数组 → REF {items}）——
    http.get("*/api/report-names/links/standard", ({ request }) => {
      const url = new URL(request.url);
      const rn = url.searchParams.get("reportNameCode");
      const role = url.searchParams.get("role");
      let items: unknown[] = inspectionReportNameStandards;
      if (rn) items = items.filter((l) => (l as { reportNameCode: string }).reportNameCode === rn);
      if (role) items = items.filter((l) => (l as { role: string }).role === role);
      return HttpResponse.json({ items, total: items.length });
    }),
    http.get("*/api/report-names/links/parameter", ({ request }) => {
      const url = new URL(request.url);
      const rn = url.searchParams.get("reportNameCode");
      const items: unknown[] = rn
        ? inspectionReportNameParameters.filter((l) => (l as { reportNameCode: string }).reportNameCode === rn)
        : inspectionReportNameParameters;
      return HttpResponse.json({ items, total: items.length });
    }),
    http.get("*/api/inspection/links/standard-parameter", ({ request }) => {
      const url = new URL(request.url);
      const sc = url.searchParams.get("standardCode");
      const items: unknown[] = sc
        ? inspectionStandardParameters.filter((l) => (l as { inspectionStandardCode: string }).inspectionStandardCode === sc)
        : inspectionStandardParameters;
      return HttpResponse.json({ items, total: items.length });
    }),
    http.get("*/api/param-interfaces/links", ({ request }) => {
      const url = new URL(request.url);
      const code = url.searchParams.get("parameterCode");
      const items: unknown[] = code
        ? paramInterfaceLinks.filter((l) => (l as { inspectionParameterCode: string }).inspectionParameterCode === code)
        : paramInterfaceLinks;
      return HttpResponse.json({ items, total: items.length });
    }),

    // —— /samples：补 keyword（REF：按 sampleCode/sampleName 搜）——
    http.get("*/api/samples", ({ request }) => {
      const url = new URL(request.url);
      const receiptId = url.searchParams.get("receiptId");
      const keyword = url.searchParams.get("keyword") ?? "";
      let items = samples.filter((s) => s.tenantId === TENANT);
      if (receiptId) items = items.filter((s) => s.receiptId === receiptId);
      if (keyword)
        items = items.filter(
          (s) =>
            (s.sampleCode ?? "").includes(keyword) ||
            (s.sampleName ?? "").includes(keyword),
        );
      return HttpResponse.json(
        pageOf(items, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), 20)),
      );
    }),

    // —— /receipts：补 categoryCode / lastSubmittedBy（REF 语义）——
    http.get("*/api/receipts", ({ request }) => {
      const url = new URL(request.url);
      const flowStatus = url.searchParams.get("flowStatus");
      const contractId = url.searchParams.get("contractId");
      const categoryCode = url.searchParams.get("categoryCode");
      const lastSubmittedBy = url.searchParams.get("lastSubmittedBy");
      const keyword = url.searchParams.get("keyword") ?? "";
      let items = sampleReceipts.filter((r) => r.tenantId === TENANT);
      if (flowStatus) items = items.filter((r) => r.flowStatus === flowStatus);
      if (contractId) items = items.filter((r) => r.contractId === contractId);
      if (categoryCode) items = items.filter((r) => r.categoryCode === categoryCode);
      if (lastSubmittedBy) items = items.filter((r) => r.lastSubmittedBy === lastSubmittedBy);
      if (keyword) items = items.filter((r) => r.commissionCode.includes(keyword));
      return HttpResponse.json(
        pageOf(items, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), 20)),
      );
    }),

    // —— /test-records：补 receiptId 过滤（经 receipt→samples 归集 sampleIds）——
    http.get("*/api/test-records", ({ request }) => {
      const url = new URL(request.url);
      const sampleId = url.searchParams.get("sampleId");
      const receiptId = url.searchParams.get("receiptId");
      let items = testRecords.filter((t) => t.tenantId === TENANT);
      if (sampleId) items = items.filter((t) => t.sampleId === sampleId);
      if (receiptId) {
        const sids = new Set(
          samples.filter((s) => s.receiptId === receiptId).map((s) => s.id),
        );
        items = items.filter((t) => sids.has(t.sampleId));
      }
      return HttpResponse.json(
        pageOf(items, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), 20)),
      );
    }),
  );
}

// ————————————————————————————————————————————————
// tablesOf：REF 测试的 `xxxTable` 单例兼容门面（写 lab-msw fixtures 可变数组）
// ————————————————————————————————————————————————

export interface TableView<T> {
  insert: (row: T) => T;
  all: () => T[];
  findById: (id: string) => T | undefined;
  reset: () => void;
}

/** 把可变 fixture 数组包成 MockTable 风格视图（insert/all/findById/reset）。
 * insert 缺 id 时补随机 id（对齐 REF MockTable.insert 的 randomUUID 行为）。 */
function tableView<T>(arr: T[]): TableView<T> {
  return {
    insert: (row) => {
      const withId = { id: crypto.randomUUID(), ...row } as T;
      (arr as T[]).push(withId);
      return withId;
    },
    all: () => arr,
    findById: (id) => (arr as Array<T & { id?: string }>).find((r) => r.id === id),
    reset: () => {
      (arr as T[]).length = 0;
    },
  };
}


/**
 * 暴露 REF 测试的 `xxxTable` 命名（替代旧 `import { receiptTable } from '../../msw/db'`）：
 *   const { receiptTable, sampleTable } = tablesOf()
 * 注意：
 *   - dictCrud 表（报告名称/参数/标准/参数界面）msw seed 无 id 列（PK 是 code），
 *     REF 测试用确定性 id 插入的行照常写入（组件按 code 读，不受影响）。
 *   - 插入 receipt/sample/testRecord 行需带 tenantId:'TENANT-001' 才能被
 *     byTenant 过滤命中。.reset() 只清空不恢复快照——恢复用 resetFixtures()。
 */
type RowRecord = { id?: string; code?: string; [k: string]: unknown };

export function tablesOf(): {
  receiptTable: TableView<RowRecord>;
  sampleTable: TableView<RowRecord>;
  contractTable: TableView<RowRecord>;
  testRecordTable: TableView<RowRecord>;
  inspectionReportNameTable: TableView<RowRecord>;
  inspectionParameterTable: TableView<RowRecord>;
  inspectionStandardTable: TableView<RowRecord>;
  inspectionStandardParameterTable: TableView<RowRecord>;
  paramInterfaceTable: TableView<RowRecord>;
  inspectionParameterParamInterfaceTable: TableView<RowRecord>;
} {
  const asRows = (a: unknown[]) => a as RowRecord[];
  return {
    receiptTable: tableView(asRows(sampleReceipts)),
    sampleTable: tableView(asRows(samples)),
    contractTable: tableView(asRows(contracts)),
    testRecordTable: tableView(asRows(testRecords)),
    inspectionReportNameTable: tableView(asRows(inspectionReportNames)),
    inspectionParameterTable: tableView(asRows(inspectionParameters)),
    inspectionStandardTable: tableView(asRows(inspectionStandards)),
    inspectionStandardParameterTable: tableView(asRows(inspectionStandardParameters)),
    paramInterfaceTable: tableView(asRows(paramInterfaces)),
    inspectionParameterParamInterfaceTable: tableView(asRows(paramInterfaceLinks)),
  };
}

// ————————————————————————————————————————————————
// seedData / seedMasterDataIntoMockDb：lab-msw seeds 已含全量主数据 → no-op
// ————————————————————————————————————————————————

/**
 * REF 的 seedMasterDataIntoMockDb 把 generated JSON 按确定性 id 重灌。
 * 本仓 lab-msw 的 seeds/*.json 就是同一份 generated 数据（模块加载即就位），
 * 无需重灌——no-op。测试要「干净」请用 resetFixtures()。
 */
export function seedMasterDataIntoMockDb(): void {
  /* no-op：lab-msw seeds 已含主数据（见上） */
}

/**
 * REF 的 seedData 灌合同 + 接样单 runtime fixtures。
 * 本仓测试用 tablesOf() + resetFixtures() 自行种少量确定性行（tenantId=TENANT-001），
 * 不需要 REF 的 40+ 接样单大种子——no-op。
 */
export function seedData(): void {
  /* no-op：本仓测试按需自种（见上） */
}
