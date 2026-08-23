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
//
// ———— Task 10 扩展（data-entry 移植收尾）————
// REF tests/helpers/seed.ts 的 seedParamInterfaces / seedData / orgInfoTable 是
// shared MockServer 架构；本仓是 lab-msw fixtures 数组架构。以下扩展按本仓模式
// 提供等价能力（移植自 REF tests/helpers/seed.ts，id/数据逐一保留）：
//   - `seedParamInterfaces(server?)`：把 inspection-param-interfaces / inspection-param-interface-links
//     两张 fixtures 清空并按 generated JSON 重灌（id 形态 `pi-${code}` 与 REF 一致）。
//     msw seed 本就含这两张表，但测试调它取「干净确定性」语义——保留 no-op 不行，
//     因为 REF 语义是 replaceAll 后重灌。参数仅为兼容 REF 调用签名，值被忽略。
//   - `seedData(server?)`：REF 的 10 合同 × 30 RN 接样单大种子（含 JSON 形状
//     test-records）——lab-msw seed 只有 6 接样单 3 类别，覆盖不了报告链路回归。
//     本仓版本向 fixtures 数组直接灌（带 tenantId，绕过 byTenant 不可见问题），
//     runtime 4 表（receipts/samples/test-records/contracts）replaceAll 语义 =
//     length=0 + 重灌。orgInfo 行灌入独立的 orgInfos 内存表（msw 无此端点）。
//   - `orgInfoTable`：REF 兼容的 org 单例表视图（tablesOf() 返回值新增）。
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
  inspectionParamInterfaces,
  inspectionParamInterfaceLinks,
  contracts,
  inspectionSpecialties,
  inspectionObjects,
  inspectionObjectStandards,
  inspectionObjectParameters,
  inspectionSpecialtyObjects,
  inspectionObjectReportNames,
  inspectionCalculationMethods,
  technicalRequirements,
} from "@lab/management-system-msw/fixtures";
import { mockResult, requirementFor } from "@/features/data-entry/reportTemplateSeed";
import { computeCementFlexural, computeCementCompress } from "@/features/data-entry/models/cement-strength";
import { tensileStrength } from "@/features/data-entry/models/rebar-welding";
import paramInterfacesJson from "@/data/generated/inspection-param-interface.json";
import paramInterfaceLinksJson from "@/data/generated/inspection-parameter-param-interface.json";
import reportNameParametersJson from "@/data/generated/inspection-report-name-parameter.json";

// ————————————————————————————————————————————————
// fixtures 快照 / 恢复
// ——————————————————————————————————————————————

const SNAPSHOTTED: Array<{ arr: unknown[]; snapshot: unknown[] }> = [
  sampleReceipts, samples, testRecords, inspectionReportNames, inspectionParameters,
  inspectionStandards, inspectionStandardParameters, inspectionReportNameStandards,
  inspectionReportNameParameters, inspectionParamInterfaces, inspectionParamInterfaceLinks, contracts,
  inspectionSpecialties, inspectionObjects, inspectionObjectStandards,
  inspectionObjectParameters, inspectionSpecialtyObjects, inspectionObjectReportNames,
  inspectionCalculationMethods, technicalRequirements,
].map((arr) => ({ arr: arr as unknown[], snapshot: structuredClone(arr) }));

/** 把 fixtures 恢复到模块加载时的快照（引用不变，内容重置）。 */
export function resetFixtures(): void {
  for (const { arr, snapshot } of SNAPSHOTTED) {
    arr.length = 0;
    arr.push(...snapshot);
  }
  orgInfos.length = 0;
}

// ————————————————————————————————————————————————
// 形状适配层（server.use 优先级最高；每个 beforeEach 重装）
// ——————————————————————————————————————————————

const TENANT = "TENANT-001";

function pageOf<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
}

function num(v: string | null, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

// ———— Task 13：M06 主表 / junction 适配 helper（dictCrud 裸数组 → REF 形状）————

/** M06 主表：补 id=code（REF 组件 rowId 读 id 列；msw dictCrud 以 code 为主键），
 * 支持 keyword（code/name includes）+ REF 过滤参数语义：
 *  - 有同名列的行直接按列过滤（objects.inspectionSpecialtyCode）；
 *  - 无同名列的（standards/parameters 按专项/项目/标准过滤）经 junction 表反查——
 *    REF 语义：standards?inspectionObjectCode=… 经 inspection-object-standards，
 *    standards?inspectionSpecialtyCode=… 经 specialty-object + object-standard 两跳，
 *    parameters 同理（object → object-parameter / standard-parameter）。 */
function wrapDict(
  rows: Array<Record<string, unknown>>,
  request: Request,
  junctions?: {
    /** 本表自身的 code 列名 */
    selfCodeKey?: string;
    /** 过滤参数 → 反查路径（junction 数组 + 两端列名；可两跳） */
    reverse?: Record<string, Array<{ link: Array<Record<string, unknown>>; from: string; to: string }>>;
    /** 聚合列（老 shared lab-handlers 语义，backup/lab-management-system-shared
     * mocks/runtime/handlers/lab-handlers.ts）：本行 code 经 junction 关联的对端
     * code（names 给了则映射成名称，查不到回退 code）去重后以全角逗号 join。
     * names Map 在 handler 闭包里现算，保证测试中新增行也拿到新名。 */
    aggregate?: Array<{
      as: string;
      link: Array<Record<string, unknown>>;
      selfCol: string;
      otherCol: string;
      names?: Map<string, string>;
    }>;
  },
) {
  const selfCodeKey = junctions?.selfCodeKey ?? "code";
  const url = new URL(request.url);
  const withId: Array<Record<string, unknown>> = rows.map((r) => ({
    ...r,
    id: String(r["id"] ?? r[selfCodeKey]),
  }));
  let items = withId;
  const kw = url.searchParams.get("keyword") ?? "";
  if (kw)
    items = items.filter(
      (r) => String(r["code"] ?? "").includes(kw) || String(r["name"] ?? "").includes(kw),
    );
  for (const key of [
    "inspectionSpecialtyCode",
    "inspectionObjectCode",
    "inspectionStandardCode",
    "inspectionParameterCode",
  ]) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    if (items.length > 0 && key in (items[0] as Record<string, unknown>)) {
      // 主表自带该列（objects.inspectionSpecialtyCode）→ 直接过滤
      items = items.filter((r) => r[key] === v);
    } else if (junctions?.reverse?.[key]) {
      // 经 junction 反查：沿 from→to 逐跳收集允许的 code 集合
      let allowed: Set<string> | null = null;
      for (const hop of junctions.reverse[key]) {
        const next = new Set(
          hop.link
            .filter((l) => allowed === null || allowed.has(String(l[hop.from] ?? "")))
            .map((l) => String(l[hop.to] ?? ""))
            .filter(Boolean),
        );
        allowed = next;
      }
      items = allowed ? items.filter((r) => allowed!.has(String(r[selfCodeKey] ?? ""))) : items;
    }
    // 无列也无反查配置 → 不过滤（调用方保证语义）
  }
  const paged = pageOf(
    items,
    num(url.searchParams.get("page"), 1),
    num(url.searchParams.get("pageSize"), items.length || 1),
  );
  if (!junctions?.aggregate?.length) return HttpResponse.json(paged);
  return HttpResponse.json({
    ...paged,
    items: paged.items.map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const a of junctions.aggregate!) {
        out[a.as] = [
          ...new Set(
            a.link
              .filter((l) => String(l[a.selfCol] ?? "") === String(r[selfCodeKey] ?? ""))
              .map((l) => {
                const code = String(l[a.otherCol] ?? "");
                return a.names?.get(code) ?? code;
              })
              .filter(Boolean),
          ),
        ].join("，");
      }
      return out;
    }),
  });
}

/** M06 junction：支持 query 参数 → 列精确匹配（键=query 参数名=列名）。 */
function wrapLinks(
  rows: Array<Record<string, unknown>>,
  request: Request,
  filterKeys: Record<string, string>,
) {
  const url = new URL(request.url);
  let items: Array<Record<string, unknown>> = rows;
  for (const [param, col] of Object.entries(filterKeys)) {
    const v = url.searchParams.get(param);
    if (v) items = items.filter((r) => r[col] === v);
  }
  return HttpResponse.json({ items, total: items.length });
}

/** M06 junction DELETE：REF 组件发 query 参数（apiClient.delete(url, { params })），
 * lab-msw handler 读 request body。这里把 query 参数镜像成 body 按 handlers 同款
 * 键匹配语义原地删除（含 extraFields 键如 role）。 */
function linkDelete(arr: Array<Record<string, unknown>>) {
  return async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const keys = Array.from(url.searchParams.keys());
    let idx = -1;
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (!row) continue;
      const hit = keys.every((k) => String(row[k] ?? "") === url.searchParams.get(k));
      if (hit) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) arr.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  };
}

// ————————————————————————————————————————————————
// Task 11 扩展（reports 4 阶段页 + audit）：
//   - POST /api/receipts/flow：lab-msw 返回裸数组（组件 runFlow 期望 res.data.results）
//     且 withdraw 是 no-op。这里对同一 sampleReceipts fixtures 数组重实现完整语义：
//     submit（前进一阶 + lastSubmittedBy + issuance 补 issuedAt）/ return（后退一阶）/
//     withdraw（后退一阶 + 清 lastSubmittedBy，仅限本人提交的），flowHistory 同步 push。
//     语义参考 lab-msw src/handlers-extra.ts reportFlowExtraHandlers + REF 类型注释
//     （withdraw=提交人主动收回——msw 仓标了 no-op 债，测试穿透需要真流转）。
//   - GET /api/audit-logs：lab-msw 无该 handler。从 fixtures 的 flowHistory 派生审计
//     条目（type='flow'，操作对象=委托书编号），支持 REF auditStore 的分页 + type/keyword
//     过滤参数形状（dateFrom/dateTo 宽松忽略——种子时间线集中，无按日过滤断言需求）。
// ————————————————————————————————————————————————

/** flow 状态流转语义（与 lab-msw handlers-extra nextStatus/prevStatus 一致，含 completed 终态） */
const FLOW_ORDER_FULL = [
  'receiving', 'task_assignment', 'data_entry', 'review', 'approval', 'issuance', 'archived', 'completed',
] as const;

/**
 * 安装 REF 形状适配 handler：
 *  - dictCrud 表（report-names / standards / parameters / inspection-param-interfaces）：裸数组 → {items,total}
 *  - 4 条链接 GET：裸数组 → {items,total}（保留过滤参数语义 + role）
 *  - /samples：+ keyword（sampleCode/sampleName includes）
 *  - /receipts：+ categoryCode / lastSubmittedBy
 *  - /test-records：+ receiptId（经 receipt→samples 归集 sampleIds）
 */
export function installShapeAdapters(server: { use: (...h: unknown[]) => void }): void {
  server.use(
    // —— dictCrud 主表（msw 裸数组 → REF {items}）——
    // Task 13：report-names/inspection-param-interfaces 走 wrapDict（补 id=code + keyword 过滤）；
    // standards/parameters 的 wrapDict（含 junction 反查）在下方 Task 13 段注册——
    // 同 URL 后注册者胜（msw use() 头插），此处不重复注册。
    http.get("*/api/report-names", ({ request }) => wrapDict(inspectionReportNames as unknown as Array<Record<string, unknown>>, request)),
    http.get("*/api/inspection-param-interfaces", ({ request }) => wrapDict(inspectionParamInterfaces as unknown as Array<Record<string, unknown>>, request)),

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
    http.get("*/api/inspection-param-interfaces/links", ({ request }) => {
      const url = new URL(request.url);
      // Task 13 Step 3：补 REF 过滤参数族（inspectionParamInterfaceCode / reportNameCode，
      // 见 backup shared lab-handlers.ts paramInterfaceLinkHandlers GET）。原先只支持
      // parameterCode；无这些参数的既有调用行为不变。
      const code = url.searchParams.get("parameterCode");
      const pic = url.searchParams.get("inspectionParamInterfaceCode");
      const rn = url.searchParams.get("reportNameCode");
      let items: unknown[] = inspectionParamInterfaceLinks;
      if (code) items = items.filter((l) => (l as { inspectionParameterCode: string }).inspectionParameterCode === code);
      if (pic) items = items.filter((l) => (l as { inspectionParamInterfaceCode: string }).inspectionParamInterfaceCode === pic);
      if (rn) items = items.filter((l) => (l as { reportNameCode?: string }).reportNameCode === rn);
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

    // —— POST /receipts/flow：REF 形状 {results} + 完整流转语义（Task 11）——
    // lab-msw 返回裸数组且 withdraw no-op；组件 runFlow 读 res.data.results。
    // 对同一 sampleReceipts fixtures 原地流转，flowHistory push（数据同源）。
    http.post("*/api/receipts/flow", async ({ request }) => {
      const body = (await request.json()) as {
        ids: string[];
        action: "submit" | "return" | "withdraw";
        operator: string;
        reason?: string;
      };
      const now = new Date().toISOString();
      const results = body.ids.map((id) => {
        const r = sampleReceipts.find((x) => x.id === id) as
          | { id: string; commissionCode?: string; flowStatus: string; lastSubmittedBy?: string | null; issuedAt?: string | null; flowHistory?: unknown[]; updatedAt?: string }
          | undefined;
        if (!r) return { id, ok: false, message: "Receipt not found" };
        const idx = FLOW_ORDER_FULL.indexOf(r.flowStatus as (typeof FLOW_ORDER_FULL)[number]);
        if (idx < 0) return { id, ok: false, message: `Unknown flowStatus: ${r.flowStatus}` };
        const to =
          body.action === "submit"
            ? FLOW_ORDER_FULL[idx + 1]
            : FLOW_ORDER_FULL[idx - 1];
        if (!to) {
          return {
            id,
            ok: false,
            message:
              body.action === "submit" ? "Already at final stage" : "Already at first stage",
          };
        }
        // withdraw 仅限本人最近提交的单据（提交人主动收回）
        if (body.action === "withdraw" && r.lastSubmittedBy !== body.operator) {
          return { id, ok: false, message: "只能撤回本人提交的单据" };
        }
        const from = r.flowStatus;
        r.flowStatus = to;
        if (body.action === "submit") {
          r.lastSubmittedBy = body.operator;
          if (to === "issuance") r.issuedAt = now;
        } else if (body.action === "withdraw") {
          r.lastSubmittedBy = null;
        }
        (r.flowHistory ??= []).push({
          action: body.action,
          from,
          to,
          operator: body.operator,
          at: now,
          reason: body.reason,
        });
        r.updatedAt = now;
        return { id, ok: true, flowStatus: r.flowStatus };
      });
      return HttpResponse.json({ results });
    }),

    // ———— Task 13 扩展（M06 检测能力 10 组件）————
    // lab-msw dictCrud/junction GET 返回裸数组且不支持 REF 的过滤参数族
    // （keyword / inspectionSpecialtyCode / inspectionObjectCode / inspectionStandardCode /
    //   testingStandardCode / judgmentStandardCode / reportNameCode / inspectionParamInterfaceCode）。
    // 这里对同一 fixtures 数组重实现 REF 语义：裸数组 → {items,total} + 全过滤参数。
    // 主表路由（/api/inspection/specialties 等）REF 组件按 `/:id` PUT/DELETE，msw dictCrud
    // 按 `/:code`——seed 行无 id 列，组件行 id 取 code 语义（rowId 读 (item as {id}).id，
    // 适配层在 wrap 时补 id=code，PUT/DELETE `/:code` 天然命中 msw handler）。
    // 计算方法 / 技术要求 msw 主键是复合键，REF 组件 PUT/DELETE `/:id`——在 wrap 时
    // 补 id（`cr-${objectCode}-${parameterCode}` / `tr-${objectCode}-${parameterCode}-${std}`），
    // 并拦截 PUT/DELETE `/:id` 反查复合键转发 fixtures 原地写。
    http.get("*/api/inspection/specialties", ({ request }) =>
      wrapDict(inspectionSpecialties as unknown as Array<Record<string, unknown>>, request)),
    http.get("*/api/inspection/objects", ({ request }) =>
      wrapDict(inspectionObjects as unknown as Array<Record<string, unknown>>, request, {
        // 聚合列（老 shared 语义）：parameterNames（经 object-parameter，名称）+ standardCodes（经 object-standard）
        aggregate: [
          {
            as: "parameterNames",
            link: inspectionObjectParameters as unknown as Array<Record<string, unknown>>,
            selfCol: "inspectionObjectCode",
            otherCol: "inspectionParameterCode",
            names: new Map(
              (inspectionParameters as unknown as Array<{ code: string; name: string }>).map((p) => [
                String(p.code),
                String(p.name),
              ]),
            ),
          },
          {
            as: "standardCodes",
            link: inspectionObjectStandards as unknown as Array<Record<string, unknown>>,
            selfCol: "inspectionObjectCode",
            otherCol: "inspectionStandardCode",
          },
        ],
      })),
    // standards 有 status 列（active/superseded/draft），REF 状态列直读；
    // 按专项/项目过滤经 junction 反查（REF 语义）
    http.get("*/api/inspection/standards", ({ request }) =>
      wrapDict(inspectionStandards as unknown as Array<Record<string, unknown>>, request, {
        reverse: {
          inspectionSpecialtyCode: [
            {
              link: inspectionSpecialtyObjects as unknown as Array<Record<string, unknown>>,
              from: "inspectionSpecialtyCode",
              to: "inspectionObjectCode",
            },
            {
              link: inspectionObjectStandards as unknown as Array<Record<string, unknown>>,
              from: "inspectionObjectCode",
              to: "inspectionStandardCode",
            },
          ],
          inspectionObjectCode: [
            {
              link: inspectionObjectStandards as unknown as Array<Record<string, unknown>>,
              from: "inspectionObjectCode",
              to: "inspectionStandardCode",
            },
          ],
        },
        // 聚合列（老 shared 语义）：parameterNames（经 standard-parameter，名称）
        aggregate: [
          {
            as: "parameterNames",
            link: inspectionStandardParameters as unknown as Array<Record<string, unknown>>,
            selfCol: "inspectionStandardCode",
            otherCol: "inspectionParameterCode",
            names: new Map(
              (inspectionParameters as unknown as Array<{ code: string; name: string }>).map((p) => [
                String(p.code),
                String(p.name),
              ]),
            ),
          },
        ],
      })),

    // parameters 按专项/项目过滤经 junction 反查；按标准过滤经 standard-parameter 反查
    http.get("*/api/inspection/parameters", ({ request }) =>
      wrapDict(inspectionParameters as unknown as Array<Record<string, unknown>>, request, {
        reverse: {
          inspectionSpecialtyCode: [
            {
              link: inspectionSpecialtyObjects as unknown as Array<Record<string, unknown>>,
              from: "inspectionSpecialtyCode",
              to: "inspectionObjectCode",
            },
            {
              link: inspectionObjectParameters as unknown as Array<Record<string, unknown>>,
              from: "inspectionObjectCode",
              to: "inspectionParameterCode",
            },
          ],
          inspectionObjectCode: [
            {
              link: inspectionObjectParameters as unknown as Array<Record<string, unknown>>,
              from: "inspectionObjectCode",
              to: "inspectionParameterCode",
            },
          ],
          inspectionStandardCode: [
            {
              link: inspectionStandardParameters as unknown as Array<Record<string, unknown>>,
              from: "inspectionStandardCode",
              to: "inspectionParameterCode",
            },
          ],
        },
        // 聚合列（老 shared 语义）：objectNames（经 object-parameter 反查，名称）+ standardCodes（经 standard-parameter）
        aggregate: [
          {
            as: "objectNames",
            link: inspectionObjectParameters as unknown as Array<Record<string, unknown>>,
            selfCol: "inspectionParameterCode",
            otherCol: "inspectionObjectCode",
            names: new Map(
              (inspectionObjects as unknown as Array<{ code: string; name: string }>).map((o) => [
                String(o.code),
                String(o.name),
              ]),
            ),
          },
          {
            as: "standardCodes",
            link: inspectionStandardParameters as unknown as Array<Record<string, unknown>>,
            selfCol: "inspectionParameterCode",
            otherCol: "inspectionStandardCode",
          },
        ],
      })),

    // —— junction GET（4 类 + report-name 3 类 + inspection-param-interface links，裸数组 → {items,total} + 过滤参数）——
    http.get("*/api/inspection/links/specialty-object", ({ request }) =>
      wrapLinks(inspectionSpecialtyObjects as unknown as Array<Record<string, unknown>>, request, {
        inspectionSpecialtyCode: "inspectionSpecialtyCode",
      })),
    http.get("*/api/inspection/links/object-standard", ({ request }) =>
      wrapLinks(inspectionObjectStandards as unknown as Array<Record<string, unknown>>, request, {
        inspectionObjectCode: "inspectionObjectCode",
        role: "role",
      })),
    http.get("*/api/inspection/links/object-parameter", ({ request }) =>
      wrapLinks(inspectionObjectParameters as unknown as Array<Record<string, unknown>>, request, {
        inspectionObjectCode: "inspectionObjectCode",
        inspectionParameterCode: "inspectionParameterCode",
      })),
    http.get("*/api/report-names/links/object", ({ request }) =>
      wrapLinks(inspectionObjectReportNames as unknown as Array<Record<string, unknown>>, request, {
        reportNameCode: "reportNameCode",
        inspectionObjectCode: "inspectionObjectCode",
      })),

    // —— junction DELETE：REF 组件发 query 参数，msw handler 读 body——query → 键匹配原地删除
    http.delete("*/api/inspection/links/specialty-object", linkDelete(inspectionSpecialtyObjects as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/inspection/links/object-standard", linkDelete(inspectionObjectStandards as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/inspection/links/object-parameter", linkDelete(inspectionObjectParameters as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/report-names/links/object", linkDelete(inspectionObjectReportNames as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/report-names/links/standard", linkDelete(inspectionReportNameStandards as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/report-names/links/parameter", linkDelete(inspectionReportNameParameters as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/inspection-param-interfaces/links", linkDelete(inspectionParamInterfaceLinks as unknown as Array<Record<string, unknown>>)),
    http.delete("*/api/inspection/links/standard-parameter", linkDelete(inspectionStandardParameters as unknown as Array<Record<string, unknown>>)),

    // —— 计算方法 GET：+ testingStandardCode 过滤（msw 只支持 object/parameter）——
    http.get("*/api/calculation-methods", ({ request }) => {
      const url = new URL(request.url);
      const std = url.searchParams.get("testingStandardCode");
      let items = (inspectionCalculationMethods as unknown as Array<Record<string, unknown>>)
        .map((r): Record<string, unknown> => ({ ...r, id: String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`) }));
      if (std) items = items.filter((r) => r["testingStandardCode"] === std);
      return HttpResponse.json(pageOf(items, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), items.length || 1)));
    }),
    // 计算方法 PUT/DELETE /:id → 复合键转发（REF 组件以 id 调用，msw 是复合键路由）
    http.put("*/api/calculation-methods/:id", async ({ params, request }) => {
      const row = (inspectionCalculationMethods as unknown as Array<Record<string, unknown>>)
        .find((r) => String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`) === params.id);
      if (!row) return HttpResponse.json({ message: "CalculationMethod not found" }, { status: 404 });
      Object.assign(row, (await request.json()) as object, { updatedAt: new Date().toISOString() });
      return HttpResponse.json(row);
    }),
    http.delete("*/api/calculation-methods/:id", ({ params }) => {
      const arr = inspectionCalculationMethods as unknown as Array<Record<string, unknown>>;
      const i = arr.findIndex((r) => String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`) === params.id);
      if (i < 0) return HttpResponse.json({ message: "CalculationMethod not found" }, { status: 404 });
      arr.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),

    // —— 技术要求 GET：+ judgmentStandardCode 过滤（msw 只支持 object/parameter）——
    http.get("*/api/technical-requirements", ({ request }) => {
      const url = new URL(request.url);
      const std = url.searchParams.get("judgmentStandardCode");
      let items = (technicalRequirements as unknown as Array<Record<string, unknown>>)
        .map((r): Record<string, unknown> => ({ ...r, id: String(r["id"] ?? `tr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}-${r["judgmentStandardCode"]}`) }));
      if (std) items = items.filter((r) => r["judgmentStandardCode"] === std);
      return HttpResponse.json(pageOf(items, num(url.searchParams.get("page"), 1), num(url.searchParams.get("pageSize"), items.length || 1)));
    }),
    http.put("*/api/technical-requirements/:id", async ({ params, request }) => {
      const row = (technicalRequirements as unknown as Array<Record<string, unknown>>)
        .find((r) => String(r.id ?? `tr-${r.inspectionObjectCode}-${r.inspectionParameterCode}-${r.judgmentStandardCode}`) === params.id);
      if (!row) return HttpResponse.json({ message: "TechnicalRequirement not found" }, { status: 404 });
      Object.assign(row, (await request.json()) as object, { updatedAt: new Date().toISOString() });
      return HttpResponse.json(row);
    }),
    http.delete("*/api/technical-requirements/:id", ({ params }) => {
      const arr = technicalRequirements as unknown as Array<Record<string, unknown>>;
      const i = arr.findIndex((r) => String(r.id ?? `tr-${r.inspectionObjectCode}-${r.inspectionParameterCode}-${r.judgmentStandardCode}`) === params.id);
      if (i < 0) return HttpResponse.json({ message: "TechnicalRequirement not found" }, { status: 404 });
      arr.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),

    // —— GET /audit-logs：从 flowHistory 派生审计条目（Task 11；lab-msw 无此端点）——
    // 组件 catch 兜底是 error 提示而非崩溃，但列表页 smoke 取「空数据也正常渲染」
    // 之外再给一条真实数据路径：每条 flowHistory 生成 type='flow' 的条目。
    // ---- Task 13 Step 3（M06.F08 参数界面 REF 语义）----
    // msw dictCrud 以 code 为主键（POST 无 id/isOfficial 形状、PUT/DELETE /:code、
    // links POST 204 裸 push）；REF 组件/测试按 /:id（id=`pi-${code}`）调用，且
    // REF shared lab-handlers.ts paramInterfaceHandlers/paramInterfaceLinkHandlers 有：
    //   POST 校验 + 重复 400；DELETE 内置（isOfficial）不可删 400；
    //   links POST 确定性 id + 重复 400 + 201。
    // 这里对同一 inspectionParamInterfaces / inspectionParamInterfaceLinks fixtures 原地实现 REF 语义。
    http.post("*/api/inspection-param-interfaces", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (!body["code"] || !body["name"] || !body["componentPath"])
        return HttpResponse.json({ message: "code/name/componentPath 必填" }, { status: 400 });
      if ((inspectionParamInterfaces as unknown as Array<{ code?: string }>).some((r) => r.code === body["code"]))
        return HttpResponse.json({ message: "参数界面编码已存在" }, { status: 400 });
      const now = new Date().toISOString();
      const row = {
        id: `pi-${String(body["code"])}`,
        code: body["code"],
        name: body["name"],
        componentPath: body["componentPath"],
        config: body["config"] ?? null,
        description: body["description"] ?? "",
        sortOrder: body["sortOrder"] ?? 999999,
        isOfficial: false,
        createdAt: now,
        updatedAt: now,
      };
      inspectionParamInterfaces.push(row as unknown as (typeof inspectionParamInterfaces)[number]);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.put("*/api/inspection-param-interfaces/:id", async ({ params, request }) => {
      const arr = inspectionParamInterfaces as unknown as Array<Record<string, unknown>>;
      const row = arr.find((r) => r["id"] === params.id || r["code"] === params.id);
      if (!row) return HttpResponse.json({ message: "InspectionParamInterface not found" }, { status: 404 });
      Object.assign(row, (await request.json()) as object, { updatedAt: new Date().toISOString() });
      return HttpResponse.json(row);
    }),
    http.delete("*/api/inspection-param-interfaces/:id", ({ params }) => {
      const arr = inspectionParamInterfaces as unknown as Array<Record<string, unknown>>;
      const i = arr.findIndex((r) => r["id"] === params.id || r["code"] === params.id);
      if (i < 0) return HttpResponse.json({ message: "参数界面不存在" }, { status: 404 });
      if (arr[i]!["isOfficial"])
        return HttpResponse.json({ message: "内置模型不可删除" }, { status: 400 });
      arr.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("*/api/inspection-param-interfaces/links", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (!body["inspectionParameterCode"] || !body["inspectionParamInterfaceCode"])
        return HttpResponse.json({ message: "inspectionParameterCode/inspectionParamInterfaceCode 必填" }, { status: 400 });
      const id = body["reportNameCode"]
        ? `pi-param-${String(body["inspectionParamInterfaceCode"])}-${String(body["inspectionParameterCode"])}-${String(body["reportNameCode"])}`
        : `pi-param-${String(body["inspectionParamInterfaceCode"])}-${String(body["inspectionParameterCode"])}`;
      const arr = inspectionParamInterfaceLinks as unknown as Array<Record<string, unknown>>;
      if (arr.some((r) => r["id"] === id))
        return HttpResponse.json({ message: "关联已存在" }, { status: 400 });
      const now = new Date().toISOString();
      const row = {
        id,
        inspectionParameterCode: body["inspectionParameterCode"],
        inspectionParamInterfaceCode: body["inspectionParamInterfaceCode"],
        reportNameCode: body["reportNameCode"],
        createdAt: now,
        updatedAt: now,
      };
      arr.push(row as unknown as Record<string, unknown>);
      return HttpResponse.json(row, { status: 201 });
    }),

    http.get("*/api/audit-logs", ({ request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      const keyword = url.searchParams.get("keyword") ?? "";
      const entries: Array<{
        id: string; type: string; action: string; operator: string;
        target: string; targetId?: string; detail?: string; at: string; ip?: string;
      }> = [];
      for (const r of sampleReceipts) {
        const rec = r as {
          id: string; commissionCode?: string; flowHistory?: Array<{
            action: string; from: string; to: string; operator: string; at: string; reason?: string;
          }>;
        };
        for (const [i, h] of (rec.flowHistory ?? []).entries()) {
          const actionLabel =
            h.action === "submit" ? "提交" : h.action === "return" ? "退回" : "撤回";
          entries.push({
            id: `audit-${rec.id}-${i}`,
            type: "flow",
            action: `${actionLabel}（${h.from} → ${h.to}）`,
            operator: h.operator,
            target: rec.commissionCode ?? rec.id,
            targetId: rec.id,
            detail: h.reason,
            at: h.at,
          });
        }
      }
      let items = entries;
      if (type) items = items.filter((e) => e.type === type);
      if (keyword) {
        items = items.filter(
          (e) =>
            e.action.includes(keyword) ||
            e.operator.includes(keyword) ||
            e.target.includes(keyword) ||
            (e.detail ?? "").includes(keyword),
        );
      }
      // 时间倒序（最新在前，符合审计日志惯例）
      items = [...items].sort((a, b) => b.at.localeCompare(a.at));
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
 *   - REF 调用形态 `tablesOf(server)`（shared MockServer 句柄）；本仓 fixtures
 *     不需要 server，参数仅为签名兼容，传入即忽略。
 */
type RowRecord = { id?: string; code?: string; [k: string]: unknown };

/** org-infos 独立内存表（lab-msw 无该端点；REF orgInfoTable 等价物）。 */
const orgInfos: RowRecord[] = [];

export function tablesOf(_server?: unknown): {
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
  orgInfoTable: TableView<RowRecord>;
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
    paramInterfaceTable: tableView(asRows(inspectionParamInterfaces)),
    inspectionParameterParamInterfaceTable: tableView(asRows(inspectionParamInterfaceLinks)),
    orgInfoTable: tableView(orgInfos),
  };
  void _server; // REF 调用签名兼容参数（tablesOf(server)），本仓 fixtures 不需要
}

// ————————————————————————————————————————————————
// seedParamInterfaces / seedMasterDataIntoMockDb / seedData
// ————————————————————————————————————————————————

/**
 * 参数界面种子（M06.F08）：灌入 generated JSON 中的卡片模型注册表 + 参数↔界面关联。
 *
 * REF tests/helpers/seed.ts seedParamInterfaces(server) 的等价物：清空两张 fixtures
 * 后按 generated JSON 重灌（id 形态 `pi-${code}` / `pi-param-...` 与 REF 一致）。
 * 参数 `_server` 仅为 REF 调用签名兼容（`seedParamInterfaces(server)`），值被忽略。
 */
export function seedParamInterfaces(_server?: unknown): void {
  void _server
  const now = new Date('2026-07-22T00:00:00Z').toISOString()
  const piRows = paramInterfacesJson as Array<{
    code: string; name: string; componentPath: string
    config?: Record<string, unknown> | null; description?: string
    sortOrder: number; isOfficial?: boolean
  }>
  inspectionParamInterfaces.length = 0
  for (const r of piRows) {
    inspectionParamInterfaces.push({
      id: `pi-${r.code}`, code: r.code, name: r.name, componentPath: r.componentPath,
      config: r.config ?? null, description: r.description, sortOrder: r.sortOrder,
      isOfficial: r.isOfficial, createdAt: now, updatedAt: now, tenantId: TENANT,
    } as unknown as (typeof inspectionParamInterfaces)[number])
  }

  const linkRows = paramInterfaceLinksJson as Array<{
    inspectionParameterCode: string; inspectionParamInterfaceCode: string; reportNameCode?: string
  }>
  inspectionParamInterfaceLinks.length = 0
  for (const link of linkRows) {
    inspectionParamInterfaceLinks.push({
      id: link.reportNameCode
        ? `pi-param-${link.inspectionParamInterfaceCode}-${link.inspectionParameterCode}-${link.reportNameCode}`
        : `pi-param-${link.inspectionParamInterfaceCode}-${link.inspectionParameterCode}`,
      inspectionParameterCode: link.inspectionParameterCode,
      inspectionParamInterfaceCode: link.inspectionParamInterfaceCode,
      reportNameCode: link.reportNameCode,
      createdAt: now, updatedAt: now, tenantId: TENANT,
    } as unknown as (typeof inspectionParamInterfaceLinks)[number])
  }
}

/**
 * REF 的 seedMasterDataIntoMockDb 把 generated JSON 按确定性 id 重灌。
 * 本仓 lab-msw 的 seeds/*.json 就是同一份 generated 数据（模块加载即就位），
 * 无需重灌——no-op。测试要「干净」请用 resetFixtures()。
 */
export function seedMasterDataIntoMockDb(_server?: unknown): void {
  void _server
  /* no-op：lab-msw seeds 已含主数据（见上） */
}

// ————————————————————————————————————————————————
// seedData：REF 10 合同 × 30 RN 接样单大种子（data-entry 报告链路回归用）
// 移植自 REF tests/helpers/seed.ts 的 seedContract/seedReceipt/seedData，
// 写入本仓 lab-msw fixtures 数组（tenantId=TENANT-001 保证 handler 可见）。
// ————————————————————————————————————————————————

interface SeedFlowHistoryEntry {
  action: 'submit' | 'return' | 'withdraw'
  from: string
  to: string
  operator: string
  at: string
}

const FLOW_STAGE_ORDER = [
  'receiving', 'task_assignment', 'data_entry', 'review', 'approval', 'issuance', 'archived',
] as const

function seedContractIntoFixtures(
  input: {
    id: string; contractCode: string; clientUnit: string; projectName: string
    constructionUnit: string; witnessUnit: string; witness: string
    status?: 'active' | 'archived'
  },
): void {
  const now = new Date('2026-07-22T00:00:00Z').toISOString()
  contracts.push({
    id: input.id, contractCode: input.contractCode, clientUnit: input.clientUnit,
    projectName: input.projectName, constructionUnit: input.constructionUnit,
    witnessUnit: input.witnessUnit, witness: input.witness,
    status: input.status ?? 'active', createdAt: now, updatedAt: now, tenantId: TENANT,
  } as unknown as (typeof contracts)[number])
}

/** 每类样品的默认字段（业务种子用）——与 REF tests/helpers/seed.ts SAMPLE_DEFAULTS 一致。 */
const SAMPLE_DEFAULTS: Record<string, { model?: string; specification?: string; grade?: string; brand?: string; manufacturer?: string; structuralPart?: string; representQuantity?: string; samplingDate?: string; ext: Record<string, string>; name: string }> = {
  steel: { model: '热轧带肋钢筋', specification: 'Φ22', brand: 'HRB400E', name: '热轧带肋钢筋', manufacturer: '陕钢集团', structuralPart: '主体结构', representQuantity: '60t', ext: { furnaceNo: 'LH-2024-0501', qualityCertNo: 'ZB-2024-118' } },
  cement: { model: 'P·O 42.5', name: '通用硅酸盐水泥', manufacturer: '尧柏水泥', structuralPart: '基础底板', representQuantity: '200t', ext: { factoryNo: 'CF-2024-0332', factoryDate: '2024-04-20' } },
  concrete: { model: 'C30', specification: '150×150×150mm', name: '混凝土试块', manufacturer: '鑫源混凝土有限公司', structuralPart: '3F 柱 1-8/A-D 轴', representQuantity: '120m³', samplingDate: '2024-05-01', ext: { age: '28', curing: '标准养护' } },
  concrete_ff: { model: 'C20', specification: '150×150×550mm', name: '混凝土抗折试块', manufacturer: '鑫源混凝土有限公司', structuralPart: '4F 路面 1-4/A-C 轴', representQuantity: '3 组', samplingDate: '2024-07-01', ext: { age: '28', curing: '标准养护' } },
  sand: { model: '中砂', grade: 'Ⅱ类', name: '建设用砂', manufacturer: '汉江砂场', structuralPart: '砌筑工程', representQuantity: '400t', ext: {} },
  gravel: { model: '碎石', specification: '5-25mm', grade: 'Ⅱ类', name: '建设用碎石', manufacturer: '秦岭石料厂', structuralPart: '主体结构', representQuantity: '600t', ext: {} },
  rebar_mech: { model: '直螺纹套筒连接', specification: 'Φ22', grade: 'Ⅰ级', brand: 'HRB400', name: '钢筋机械连接接头', structuralPart: '5F 梁柱节点', representQuantity: '500个', ext: { jointType: '直螺纹套筒', concreteCastingDate: '2024-05-10' } },
  concrete_perm: { model: 'P8', specification: '175×185×150mm（圆台）', name: '混凝土抗渗试件', manufacturer: '鑫源混凝土有限公司', structuralPart: '地下室外墙 B1 层', representQuantity: '1 组', samplingDate: '2024-07-12', ext: { age: '28', curing: '标准养护' } },
  mortar: { model: 'M7.5', specification: '70.7×70.7×70.7mm', name: '建筑砂浆试块', manufacturer: '现场搅拌', structuralPart: '二次结构砌筑', representQuantity: '50m³', samplingDate: '2024-08-15', ext: { age: '28', curing: '标准养护' } },
  soil: { model: '粉质黏土', grade: '路基填料', name: '土样', manufacturer: '现场取样', structuralPart: '路基回填', representQuantity: '1000m³', ext: { samplingDepth: '0.8m' } },
  rebar_weld: { model: '闪光对焊', specification: 'Φ22', brand: 'HRB400', name: '钢筋焊接接头', structuralPart: '基础底板', representQuantity: '300个', ext: { welderName: '刘师傅', welderCertNo: 'HG-0088', concreteCastingDate: '2024-05-12' } },
}

const RN_TO_LEGACY: Record<string, string> = {
  'RN-105-1': 'concrete', 'RN-105-2': 'concrete_perm',
  'RN-102-1': 'steel', 'RN-102-2': 'rebar_mech', 'RN-102-3': 'rebar_weld',
  'RN-101': 'cement', 'RN-103-1': 'sand', 'RN-103-2': 'gravel',
  'RN-103-3': 'sand', 'RN-103-4': 'gravel',
  'RN-108-2': 'mortar',
  'RN-109-1': 'soil', 'RN-109-2': 'soil', 'RN-109-3': 'soil',
}

function seedReceiptIntoFixtures(
  input: {
    id: string
    contractId: string
    commissionCode: string
    categoryCode: string
    flowStatus?: (typeof FLOW_STAGE_ORDER)[number]
    commissionDate?: string
    receivedBy?: string
    sampleCount?: number
    judgmentBasis?: string[]
    testingBasis?: string[]
    testParameters?: string[]
    /** 直接指定样品规格（覆盖 SAMPLE_DEFAULTS），用于抗折等特殊试样 */
    sampleSpecOverride?: string
  },
): void {
  const now = new Date('2026-07-22T00:00:00Z').toISOString()
  const flowStatus = input.flowStatus ?? 'receiving'
  const idx = FLOW_STAGE_ORDER.indexOf(flowStatus)
  const flowHistory: SeedFlowHistoryEntry[] = []
  for (let i = 0; i < idx; i++) {
    flowHistory.push({
      action: 'submit',
      from: FLOW_STAGE_ORDER[i]!,
      to: FLOW_STAGE_ORDER[i + 1]!,
      operator: 'u-seed',
      at: '2024-05-03T08:00:00Z',
    })
  }
  const reported = idx >= FLOW_STAGE_ORDER.indexOf('review')
  const issued = idx >= FLOW_STAGE_ORDER.indexOf('issuance')
  const tested = idx >= FLOW_STAGE_ORDER.indexOf('data_entry')
  const legacyCode = RN_TO_LEGACY[input.categoryCode] ?? input.categoryCode
  const def = SAMPLE_DEFAULTS[legacyCode] ?? SAMPLE_DEFAULTS['cement']
  const contract = contracts.find((c) => c.id === input.contractId) as
    | { projectName?: string; clientUnit?: string; buildingUnit?: string; supervisorUnit?: string; constructionUnit?: string; witnessUnit?: string; witness?: string }
    | undefined
  const rnParamCodes = (
    reportNameParametersJson as Array<{ reportNameCode: string; inspectionParameterCode: string }>
  )
    .filter((l) => l.reportNameCode === input.categoryCode)
    .map((l) => l.inspectionParameterCode)
  const effectiveTestParameters =
    input.testParameters ?? (rnParamCodes.length > 0 ? rnParamCodes : undefined)
  sampleReceipts.push({
    id: input.id,
    contractId: input.contractId,
    commissionCode: input.commissionCode,
    commissionDate: input.commissionDate ?? '2024-05-03',
    categoryCode: input.categoryCode,
    projectName: contract?.projectName ?? '',
    clientUnit: contract?.clientUnit ?? '',
    buildingUnit: contract?.buildingUnit,
    supervisorUnit: contract?.supervisorUnit,
    constructionUnit: contract?.constructionUnit,
    witnessUnit: contract?.witnessUnit,
    witness: contract?.witness,
    receivedBy: input.receivedBy ?? '王五',
    sampleSource: '施工送检',
    testCategory: '委托检验',
    testEnvironment: tested ? '温度 20±2℃　湿度 60±5%' : undefined,
    testStartDate: tested ? input.commissionDate ?? '2024-05-03' : undefined,
    testEndDate: tested ? input.commissionDate ?? '2024-05-03' : undefined,
    mainEquipment: tested ? '万能试验机 WAW-1000' : undefined,
    testOperator: tested ? '王检测' : undefined,
    remark: '',
    flowStatus,
    flowHistory,
    lastSubmittedBy: flowHistory.length > 0 ? 'u-seed' : null,
    assigneeName: idx >= FLOW_STAGE_ORDER.indexOf('data_entry') ? '检测员' : undefined,
    reportCode: reported ? `R-${input.commissionCode}` : undefined,
    reportDate: reported ? '2024-05-06' : undefined,
    conclusion: tested ? '所检项目均符合相应标准的技术要求。' : undefined,
    result: tested ? 'pass' : undefined,
    issuedAt: issued ? '2024-05-08T10:00:00Z' : null,
    judgmentBasis: input.judgmentBasis,
    testingBasis: input.testingBasis,
    testParameters: effectiveTestParameters,
    createdAt: now,
    updatedAt: now,
    tenantId: TENANT,
  } as unknown as (typeof sampleReceipts)[number])

  // 每个接样单 seed 1-N 个样品（数据录入及之后的阶段附带检测项）
  const count = input.sampleCount ?? 2
  for (let i = 1; i <= count; i++) {
    const sid = `s-${input.id}-${i}`
    const spec = input.sampleSpecOverride ?? def?.specification
    const extDef = spec === '150×150×550mm' ? (SAMPLE_DEFAULTS['concrete_ff'] ?? def) : def
    samples.push({
      id: sid,
      receiptId: input.id,
      sampleCode: `${input.commissionCode}-S${i}`,
      sampleName: extDef?.name ?? '样品',
      model: extDef?.model,
      specification: spec,
      grade: extDef?.grade,
      brand: extDef?.brand,
      manufacturer: extDef?.manufacturer,
      structuralPart: extDef?.structuralPart,
      representQuantity: extDef?.representQuantity,
      sampleQuantity: '1 组',
      arrivalDate: extDef?.samplingDate,
      samplingDate: extDef?.samplingDate,
      age: extDef?.ext?.age,
      curingCondition: extDef?.ext?.curing,
      ext: { ...(extDef?.ext ?? {}) },
      remark: '',
      createdAt: now,
      updatedAt: now,
      tenantId: TENANT,
    } as unknown as (typeof samples)[number])
    if (tested) {
      seedTestRecordsForSample(sid, i, input.categoryCode)
    }
  }
}

function seedTestRecordsForSample(sid: string, i: number, categoryCode: string): void {
  const now = new Date('2026-07-22T00:00:00Z').toISOString()
  const insert = (parameterCode: string, requirement: string, result: string, verdict: string, suffix = '') => {
    testRecords.push({
      id: `ti-${sid}${suffix}-${parameterCode}`,
      sampleId: sid,
      parameterCode,
      requirement,
      result,
      verdict,
      createdAt: now,
      updatedAt: now,
      tenantId: TENANT,
    } as unknown as (typeof testRecords)[number])
  }
  // (a) 主参数一条——兼容既有汇总/判定测试
  const itemByCat: Record<string, { p: string; v: string; u?: string; req: string }> = {
    'RN-102-1': { p: 'STE001', v: `${420 + i * 5}`, u: 'MPa', req: '≥ 400 MPa' },
    'RN-101': { p: 'CEM012', v: '18.2', u: 'MPa', req: '≥ 17.0 MPa' },
    'RN-105-1': (() => {
      const _loads = [30.5, 31.5, 32.5].map((v) => v + i * 0.5)
      const _strs = _loads.map((v) => Math.round(((v * 1000) / 22500) * 100) / 100)
      const _rep = Math.round((_strs.reduce((a, b) => a + b, 0) / _strs.length) * 100) / 100
      return {
        p: 'IP-0055',
        v: JSON.stringify({ loads: _loads, strengths: _strs, representative: _rep }),
        u: 'MPa',
        req: '≥ 28.5 MPa',
      }
    })(),
    'RN-103-1': { p: 'SND002', v: '2.1', u: '%', req: '≤ 3.0 %' },
    'RN-103-2': { p: 'GRV005', v: '12', u: '%', req: '≤ 20 %' },
    'RN-102-2': { p: 'RMK001', v: '575', u: 'MPa', req: '≥ 540 MPa' },
    'RN-102-3': { p: 'RWD001', v: '605', u: 'MPa', req: '≥ 540 MPa' },
  }
  const it = itemByCat[categoryCode]
  if (it) {
    insert(it.p, it.req, it.v, '合格')
  }
  // (b) 按 RN→参数 关联种全参数（报告预览全字段填充）
  const rnParams = (reportNameParametersJson as Array<{ reportNameCode: string; inspectionParameterCode: string }>)
    .filter((l) => l.reportNameCode === categoryCode)
  // 水泥胶砂强度参数：卡片按 {loads,strengths,mean} JSON 反解析破坏荷载
  const STRENGTH_SEED: Record<string, { kind: 'flexural' | 'compress'; loads: number[] }> = {
    'IP-0555': { kind: 'flexural', loads: [1.95, 2.0, 2.05] },
    'IP-0557': { kind: 'flexural', loads: [2.95, 3.0, 3.05] },
    'IP-0556': { kind: 'compress', loads: [33, 34, 35, 33.5, 34.5, 35.5] },
    'IP-0558': { kind: 'compress', loads: [74, 75, 76, 74.5, 75.5, 76.5] },
  }
  // 颗粒级配 / 抗渗 / 击实 / 压实度 / 砂浆抗压 等新卡的种子（与 REF 一致）
  const CARD_SEED: Record<string, (sampleIdx: number, rn: string) => string | undefined> = {
    'IP-0577': (i, rn) => {
      const gravel = rn === 'RN-103-2' || rn === 'RN-103-4'
      const base = gravel
        ? [0, 0, 0, 0, 2.5, 8.4, 15.2, 28.6, 18.3, 20.1, 5.6, 1.3].map((v) => Math.round(v * 0.97 * 10) / 10)
        : [2.1, 12.4, 20.6, 24.3, 22.8, 13.5, 4.3].map((v) => Math.round(v * 0.96 * 10) / 10)
      const mkRow = (shift: number) => {
        const retainedPct = base.map((v) => (v === 0 ? 0 : Math.round((v + shift) * 10) / 10))
        let acc = 0
        const cumulativePct = retainedPct.map((v) => {
          acc += v
          return Math.round(acc * 100) / 100
        })
        const topSix = cumulativePct.slice(0, Math.min(6, retainedPct.length - 1))
        const bottom = cumulativePct[retainedPct.length - 1] ?? 0
        const finenessModulus =
          bottom >= 105 ? 0 : Math.round((topSix.reduce((a, b) => a + b, 0) / (100 - bottom)) * 100) / 100
        return { retainedPct, cumulativePct, finenessModulus, totalBefore: 500, totalAfter: 497 }
      }
      const rowCount = gravel ? 1 : 2
      const rows = Array.from({ length: rowCount }, (_, r) => mkRow(i * 0.05 + r * 0.1))
      const average = base.map(
        (_, c) =>
          Math.round(
            (rows.reduce((a, row) => a + (row.retainedPct[c] ?? 0), 0) / rows.length) * 10,
          ) / 10,
      )
      const averageCumulativePct = Array.from({ length: base.length }, (_, c) => {
        const perRowCum = rows.map((row) =>
          row.retainedPct.slice(0, c + 1).reduce((a, b) => a + b, 0),
        )
        return Math.round((perRowCum.reduce((a, b) => a + b, 0) / perRowCum.length) * 100) / 100
      })
      const validFms = rows.map((r) => r.finenessModulus).filter((fm) => fm > 0)
      const averageFinenessModulus =
        validFms.length > 0
          ? Math.round((validFms.reduce((a, b) => a + b, 0) / validFms.length) * 100) / 100
          : 0
      return JSON.stringify({
        rows, sieveCount: base.length, average, averageCumulativePct, averageFinenessModulus,
      })
    },
    'IP-0190': (i) => {
      const start = 0.7 + i * 0.1
      const specimens = Array.from({ length: 6 }, (_, k) => ({
        pressure: Math.round((start + k * 0.1) * 10) / 10,
        permeated: k >= 3 ? '已渗' : '未渗',
      }))
      const grade = specimens[5]!.pressure
      return JSON.stringify({
        specimens, grade, gradeLabel: `P${Math.round(grade * 10)}`, reason: undefined,
      })
    },
    'IP-0226': (i) => {
      const points = [
        { moisture: 10.2, dryDensity: 1.782 },
        { moisture: 12.4, dryDensity: 1.845 },
        { moisture: 14.6, dryDensity: 1.876 },
        { moisture: 16.8, dryDensity: 1.851 },
        { moisture: 18.9, dryDensity: 1.798 },
      ].map((p) => ({ ...p, dryDensity: Math.round((p.dryDensity + i * 0.002) * 1000) / 1000 }))
      return JSON.stringify({
        points, maxDryDensity: Math.round((1.878 + i * 0.002) * 1000) / 1000, optimalMoisture: 14.8,
      })
    },
    'IP-0456': (i) => {
      const maxDryDensity = 1.878
      const rows = Array.from({ length: 6 }, (_, r) => {
        const wetDensity = Math.round((2.05 + r * 0.01 + i * 0.005) * 1000) / 1000
        const moisture = Math.round((13.5 + r * 0.3) * 10) / 10
        const dryDensity = Math.round((wetDensity / (1 + moisture / 100)) * 1000) / 1000
        const degree = Math.round((dryDensity / maxDryDensity) * 1000) / 10
        return {
          code: `T-${r + 1}`,
          part: `路基第 ${r + 1} 段`,
          layer: `第 ${((r % 3) + 1)} 层`,
          designDegree: 93,
          wetDensity, moisture, dryDensity, degree,
          verdict: degree >= 93 ? '合格' : '不合格',
          maxDryDensity,
        }
      })
      return JSON.stringify({ maxDryDensity, rows })
    },
    'IP-0055': (i, rn) => {
      if (rn !== 'RN-108-2') return undefined
      const loads = [52.5, 54.0, 53.2].map((v) => Math.round((v + i * 0.5) * 100) / 100)
      const strengths = loads.map((v) => Math.round(((v * 1000) / 5000) * 100) / 100)
      const representative =
        Math.round((strengths.reduce((a, b) => a + b, 0) / strengths.length) * 100) / 100
      return JSON.stringify({ loads, strengths, representative })
    },
  }
  const REBAR_WELD_SEED: Record<string, () => string> = {
    'IP-0087': () => JSON.stringify({
      diameter: 25,
      techReqLabel: '≥ 540 MPa',
      loads: [270, 268, 272],
      strengths: [tensileStrength(270, 25), tensileStrength(268, 25), tensileStrength(272, 25)],
      fractureDistances: [50, 55, 45],
      fractureCharacteristics: ['母材断裂', '母材断裂', '焊缝断裂'],
    }),
    'IP-0155': () => JSON.stringify({
      angles: [90, 90, 90],
      results: ['合格', '合格', '合格'],
    }),
  }
  for (const link of rnParams) {
    const pc = link.inspectionParameterCode
    if (pc === it?.p) continue
    const strength = STRENGTH_SEED[pc]
    if (strength) {
      const loads = strength.loads.map((v) => Math.round((v + i * 0.1) * 100) / 100)
      const res =
        strength.kind === 'flexural' ? computeCementFlexural(loads) : computeCementCompress(loads)
      insert(pc, requirementFor(pc).jz, JSON.stringify({
        loads, strengths: res.strengths, kept: res.kept, mean: res.mean, invalid: res.invalid,
      }), '合格', '-x')
      continue
    }
    const rebar = REBAR_WELD_SEED[pc]
    if (rebar) {
      insert(pc, pc === 'IP-0087' ? '≥ 540 MPa' : '弯曲 90° 合格', rebar(), '合格', '-x')
      continue
    }
    const card = CARD_SEED[pc]?.(i - 1, categoryCode)
    if (card !== undefined) {
      insert(pc, requirementFor(pc).jz, card, '合格', '-x')
      continue
    }
    const m = mockResult(pc)
    insert(pc, requirementFor(pc).jz, m.jcz, m.jd, '-x')
  }
}

/**
 * 全量种子：10 合同 × 30 RN 接样单（覆盖 7 阶段）——REF seedData 的本仓移植。
 *
 * 与 REF 差异：不种码表/角色/用户/计算方法（lab-msw seeds 已含主数据；本仓测试
 * 不消费后三者）。种子前先清空 runtime 4 表 + orgInfos（replaceAll 语义）。
 * orgInfo 行（`org-info-seed`）灌独立内存表，orgInfoTable 消费。
 */
export function seedData(_server?: unknown): void {
  void _server
  sampleReceipts.length = 0
  samples.length = 0
  testRecords.length = 0
  contracts.length = 0
  orgInfos.length = 0

  const now = new Date('2026-07-22T00:00:00Z').toISOString()
  orgInfos.push({
    id: 'org-info-seed',
    orgName: '中国建筑检测中心',
    registeredAddress: '北京市海淀区中关村大街 1 号',
    testingSiteAddress: '北京市朝阳区望京西路 8 号',
    postalCode: '100080',
    contactPhone: '010-88880000',
    email: 'lab@xx-test.cn',
    qualificationCertNo: 'CMA L1234',
    createdAt: now,
    updatedAt: now,
  })

  seedContractIntoFixtures({ id: 'c-001', contractCode: 'HT-2024-001', clientUnit: '石泉县城投公司', projectName: '滨江花园一期', constructionUnit: '中建三局', witnessUnit: '华监监理', witness: '张监理' })
  seedContractIntoFixtures({ id: 'c-002', contractCode: 'HT-2024-002', clientUnit: '汉江置业', projectName: '汉江新城二标段', constructionUnit: '陕建五公司', witnessUnit: '秦监监理', witness: '李监理' })
  seedContractIntoFixtures({ id: 'c-003', contractCode: 'HT-2024-003', clientUnit: '安康交建', projectName: '月河大桥引道工程', constructionUnit: '中铁七局', witnessUnit: '铁正监理', witness: '赵监理' })
  seedContractIntoFixtures({ id: 'c-004', contractCode: 'HT-2024-004', clientUnit: '石泉教育局', projectName: '第二中学教学楼', constructionUnit: '安康建工', witnessUnit: '华监监理', witness: '钱监理' })
  seedContractIntoFixtures({ id: 'c-005', contractCode: 'HT-2024-005', clientUnit: '恒信地产', projectName: '恒信广场综合体', constructionUnit: '中建八局', witnessUnit: '秦监监理', witness: '孙监理' })
  seedContractIntoFixtures({ id: 'c-006', contractCode: 'HT-2024-006', clientUnit: '汉滨区水利局', projectName: '防洪堤加固工程', constructionUnit: '陕水集团', witnessUnit: '水正监理', witness: '周监理' })
  seedContractIntoFixtures({ id: 'c-007', contractCode: 'HT-2024-007', clientUnit: '旬阳城建', projectName: '旬阳安置房三期', constructionUnit: '陕建九公司', witnessUnit: '华监监理', witness: '吴监理' })
  seedContractIntoFixtures({ id: 'c-008', contractCode: 'HT-2024-008', clientUnit: '平利文旅', projectName: '游客中心建设项目', constructionUnit: '安康建工', witnessUnit: '秦监监理', witness: '郑监理' })
  seedContractIntoFixtures({ id: 'c-009', contractCode: 'HT-2024-009', clientUnit: '紫阳交通局', projectName: '任河大桥维修加固', constructionUnit: '中交二航局', witnessUnit: '铁正监理', witness: '王监理' })
  seedContractIntoFixtures({ id: 'c-010', contractCode: 'HT-2024-010', clientUnit: '岚皋住建局', projectName: '老旧小区改造一期', constructionUnit: '陕建五公司', witnessUnit: '华监监理', witness: '冯监理', status: 'archived' })

  seedReceiptIntoFixtures({ id: 'rc-001-01', contractId: 'c-001', commissionCode: 'RC-2024-0501-01', categoryCode: 'RN-102-1', flowStatus: 'archived', commissionDate: '2024-05-01', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-001-02', contractId: 'c-001', commissionCode: 'RC-2024-0502-01', categoryCode: 'RN-105-1', flowStatus: 'issuance', commissionDate: '2024-05-02', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-001-03', contractId: 'c-001', commissionCode: 'RC-2024-0503-01', categoryCode: 'RN-102-2', flowStatus: 'approval', commissionDate: '2024-05-03' })
  seedReceiptIntoFixtures({ id: 'rc-002-01', contractId: 'c-002', commissionCode: 'RC-2024-0510-01', categoryCode: 'RN-102-1', flowStatus: 'review', commissionDate: '2024-05-10', receivedBy: '赵六' })
  seedReceiptIntoFixtures({ id: 'rc-002-02', contractId: 'c-002', commissionCode: 'RC-2024-0515-01', categoryCode: 'RN-105-1', flowStatus: 'archived', commissionDate: '2024-05-15', receivedBy: '赵六', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-002-03', contractId: 'c-002', commissionCode: 'RC-2024-0520-01', categoryCode: 'RN-102-1', flowStatus: 'receiving', commissionDate: '2024-05-20', receivedBy: '赵六' })
  seedReceiptIntoFixtures({ id: 'rc-003-01', contractId: 'c-003', commissionCode: 'RC-2024-0525-01', categoryCode: 'RN-101', flowStatus: 'review', commissionDate: '2024-05-25', receivedBy: '李工' })
  seedReceiptIntoFixtures({ id: 'rc-003-02', contractId: 'c-003', commissionCode: 'RC-2024-0526-01', categoryCode: 'RN-102-3', flowStatus: 'data_entry', commissionDate: '2024-05-26', receivedBy: '李工', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-003-03', contractId: 'c-003', commissionCode: 'RC-2024-0601-01', categoryCode: 'RN-103-1', flowStatus: 'data_entry', commissionDate: '2024-06-01', receivedBy: '李工' })
  seedReceiptIntoFixtures({ id: 'rc-004-01', contractId: 'c-004', commissionCode: 'RC-2024-0605-01', categoryCode: 'RN-102-1', flowStatus: 'review', commissionDate: '2024-06-05', receivedBy: '王工' })
  seedReceiptIntoFixtures({ id: 'rc-004-02', contractId: 'c-004', commissionCode: 'RC-2024-0606-01', categoryCode: 'RN-103-1', flowStatus: 'issuance', commissionDate: '2024-06-10', receivedBy: '王工' })
  seedReceiptIntoFixtures({ id: 'rc-005-01', contractId: 'c-005', commissionCode: 'RC-2024-0615-01', categoryCode: 'RN-105-1', flowStatus: 'issuance', commissionDate: '2024-06-15', receivedBy: '赵工', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-005-02', contractId: 'c-005', commissionCode: 'RC-2024-0620-01', categoryCode: 'RN-101', flowStatus: 'data_entry', commissionDate: '2024-06-20', receivedBy: '赵工' })
  seedReceiptIntoFixtures({ id: 'rc-006-01', contractId: 'c-006', commissionCode: 'RC-2024-0625-01', categoryCode: 'RN-102-2', flowStatus: 'archived', commissionDate: '2024-06-25', receivedBy: '陈工', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-006-02', contractId: 'c-006', commissionCode: 'RC-2024-0701-01', categoryCode: 'RN-102-1', flowStatus: 'receiving', commissionDate: '2024-07-01', receivedBy: '陈工' })
  seedReceiptIntoFixtures({ id: 'rc-007-01', contractId: 'c-007', commissionCode: 'RC-2024-0705-01', categoryCode: 'RN-105-1', flowStatus: 'data_entry', commissionDate: '2024-07-05', receivedBy: '周工', sampleCount: 3, judgmentBasis: ['GB/T 50081-2019'], testingBasis: ['GB/T 50081-2019'], testParameters: ['IP-0055'] })
  seedReceiptIntoFixtures({ id: 'rc-007-02', contractId: 'c-007', commissionCode: 'RC-2024-0710-01', categoryCode: 'RN-103-1', flowStatus: 'task_assignment', commissionDate: '2024-07-10', receivedBy: '周工' })
  seedReceiptIntoFixtures({ id: 'rc-007-03', contractId: 'c-007', commissionCode: 'RC-2024-0712-02', categoryCode: 'RN-105-2', flowStatus: 'data_entry', commissionDate: '2024-07-12', receivedBy: '周工', sampleCount: 3, sampleSpecOverride: '175×185×150mm（圆台）', judgmentBasis: ['GB/T 50082-2009'], testingBasis: ['GB/T 50082-2009'], testParameters: ['IP-0190'] })
  seedReceiptIntoFixtures({ id: 'rc-008-01', contractId: 'c-008', commissionCode: 'RC-2024-0712-01', categoryCode: 'RN-102-1', flowStatus: 'receiving', commissionDate: '2024-07-12', receivedBy: '吴工' })
  seedReceiptIntoFixtures({ id: 'rc-008-02', contractId: 'c-008', commissionCode: 'RC-2024-0715-01', categoryCode: 'RN-101', flowStatus: 'task_assignment', commissionDate: '2024-07-15', receivedBy: '吴工' })
  seedReceiptIntoFixtures({ id: 'rc-009-01', contractId: 'c-009', commissionCode: 'RC-2024-0718-01', categoryCode: 'RN-102-3', flowStatus: 'issuance', commissionDate: '2024-07-18', receivedBy: '郑工', sampleCount: 3 })
  seedReceiptIntoFixtures({ id: 'rc-009-02', contractId: 'c-009', commissionCode: 'RC-2024-0720-01', categoryCode: 'RN-103-2', flowStatus: 'issuance', commissionDate: '2024-07-20', receivedBy: '郑工' })
  seedReceiptIntoFixtures({ id: 'rc-010-01', contractId: 'c-010', commissionCode: 'RC-2024-0508-01', categoryCode: 'RN-103-2', flowStatus: 'archived', commissionDate: '2024-05-08', receivedBy: '孙工' })
  seedReceiptIntoFixtures({ id: 'rc-010-02', contractId: 'c-010', commissionCode: 'RC-2024-0510-02', categoryCode: 'RN-105-1', flowStatus: 'archived', commissionDate: '2024-05-10', receivedBy: '孙工', sampleCount: 3, judgmentBasis: ['GB/T 50081-2019'], testingBasis: ['GB/T 50081-2019'], testParameters: ['IP-0055'] })

  // ===== 补齐至 30 RN 全覆盖（flowStatus >= data_entry，确保预览有数据）=====
  const remainingRn: Array<{ id: string; code: string; date: string; contractId: string }> = [
    { id: 'rc-rn-103-3', code: 'RN-103-3', date: '2024-08-01', contractId: 'c-001' },
    { id: 'rc-rn-103-4', code: 'RN-103-4', date: '2024-08-02', contractId: 'c-001' },
    { id: 'rc-rn-103-5', code: 'RN-103-5', date: '2024-08-03', contractId: 'c-001' },
    { id: 'rc-rn-104-1', code: 'RN-104-1', date: '2024-08-04', contractId: 'c-001' },
    { id: 'rc-rn-104-2', code: 'RN-104-2', date: '2024-08-05', contractId: 'c-002' },
    { id: 'rc-rn-104-3', code: 'RN-104-3', date: '2024-08-06', contractId: 'c-002' },
    { id: 'rc-rn-104-4', code: 'RN-104-4', date: '2024-08-07', contractId: 'c-002' },
    { id: 'rc-rn-104-5', code: 'RN-104-5', date: '2024-08-08', contractId: 'c-002' },
    { id: 'rc-rn-105-3', code: 'RN-105-3', date: '2024-08-09', contractId: 'c-002' },
    { id: 'rc-rn-106-1', code: 'RN-106-1', date: '2024-08-10', contractId: 'c-003' },
    { id: 'rc-rn-106-2', code: 'RN-106-2', date: '2024-08-11', contractId: 'c-003' },
    { id: 'rc-rn-107-1', code: 'RN-107-1', date: '2024-08-12', contractId: 'c-003' },
    { id: 'rc-rn-107-2', code: 'RN-107-2', date: '2024-08-13', contractId: 'c-003' },
    { id: 'rc-rn-108-1', code: 'RN-108-1', date: '2024-08-14', contractId: 'c-001' },
    { id: 'rc-rn-108-2', code: 'RN-108-2', date: '2024-08-15', contractId: 'c-001' },
    { id: 'rc-rn-109-1', code: 'RN-109-1', date: '2024-08-16', contractId: 'c-001' },
    { id: 'rc-rn-109-2', code: 'RN-109-2', date: '2024-08-17', contractId: 'c-002' },
    { id: 'rc-rn-109-3', code: 'RN-109-3', date: '2024-08-18', contractId: 'c-002' },
    { id: 'rc-rn-110-1', code: 'RN-110-1', date: '2024-08-19', contractId: 'c-003' },
    { id: 'rc-rn-110-2', code: 'RN-110-2', date: '2024-08-20', contractId: 'c-003' },
    { id: 'rc-rn-110-3', code: 'RN-110-3', date: '2024-08-21', contractId: 'c-003' },
    { id: 'rc-rn-110-4', code: 'RN-110-4', date: '2024-08-22', contractId: 'c-003' },
  ]
  for (const r of remainingRn) {
    seedReceiptIntoFixtures({ id: r.id, contractId: r.contractId, commissionCode: `RC-${r.date.replace(/-/g, '')}-01`, categoryCode: r.code, flowStatus: 'data_entry', commissionDate: r.date })
  }
}
