// Custom MSW handlers backed by deterministic seed fixtures so CRUD persists
// in-memory. orval-generated handlers use faker data which would defeat
// cross-frontend test stability, so we intercept these endpoints before the
// orval handlers.
//
// Lab 是单租户：无 tenantId 路径参数；BASE = /api（无 v1）。
import { http, HttpResponse } from "msw";
import { jwtVerify } from "jose";
import type { FlowStatus, FlowAction, CatalogEntry, TechnicalRequirement } from "./generated_ts_shim";
import { getAudience, getIssuer, getSigningKey, signAccessToken } from "./lib/jwt-signer";

// ADR-0019：未登录态直打 = 401（与 2026-08-27 msw demo 兜底删除原则对齐）。
// Bearer token 由 signAccessToken 签发，handler 用同一 key 验签；verify 失败 throw 401。
async function requireBearer(request: Request): Promise<{ sub: string; tenant_id: string } | null> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/, "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: getIssuer(),
      audience: getAudience(),
    });
    return { sub: String(payload.sub ?? ""), tenant_id: String(payload.tenant_id ?? "") };
  } catch {
    return null;
  }
}
import {
  contracts,
  sampleReceipts,
  samples,
  testRecords,
  technicalRequirements,
  inspectionBrands,
  inspectionModels,
  inspectionSpecs,
  inspectionGrades,
  tenants,
  inspectionSpecialties,
  inspectionObjects,
  inspectionParameters,
  inspectionStandards,
  inspectionObjectParameters,
  inspectionObjectStandards,
  inspectionStandardParameters,
  inspectionSpecialtyObjects,
  inspectionCalculationMethods,
  inspectionReportNames,
  inspectionObjectReportNames,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
  inspectionParamInterfaces,
  inspectionParamInterfaceLinks,
  getContract,
  getReceipt,
  getSample,
  getTestRecord,
  brandOps,
  modelOps,
  specOps,
  gradeOps,
  getSpecialty,
  getObject,
  getParameter,
  getStandard,
  getReportName,
  getInspectionParamInterface,
  getCalculationMethod,
} from "./fixtures/seed";

const BASE = "/api";

// saas-identity-platform dev base URL 走浏览器代理（vite.config.ts server.proxy），
// 不再在 msw handler 里直接出现。详见 /api/saas/* 段注释。
const NOW = () => new Date().toISOString();

// M03 流程阶段顺序（与 FlowStatus enum 对齐）
const FLOW_ORDER: FlowStatus[] = [
  "receiving",
  "task_assignment",
  "data_entry",
  "review",
  "approval",
  "issuance",
  "archived",
  "completed",
];

function pageOf<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

// 按当前租户过滤业务数据（真后端从 token tenant_id claim 解；msw 用常量）
function byTenant<T extends { tenantId?: string }>(arr: T[]): T[] {
  return arr.filter((x) => x.tenantId === currentTenantId);
}

function notFound(msg: string) {
  return HttpResponse.json({ code: "NOT_FOUND", message: msg }, { status: 404 });
}

function newId(prefix: string) {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffff).toString(36);
  return `${prefix}-${ts}${rand}`;
}

// === M00 租户 + M01.F05 Auth (deterministic demo login) ===
// 多租户：DEMO_USER 关联 tenants[] 全部 3 个；默认选 TENANT-001。
// 真后端从 token 的 tenant_id claim 解；msw 用模块常量模拟。
const DEMO_PASSWORD = "dev123456";
// 2026-09-02 契约收敛：dev 凭证与 saas seed（V016 alice）同源，四方统一（contract-test 依赖）。
const DEMO_USER = { id: "USER-A", username: "alice", displayName: "管理员", roleCode: "admin" };
let currentTenantId = tenants[0]?.tenantId ?? "";

// 菜单快照（msw 不真调 saas /me/menus，login 成功后写空数组占位 — 与
// springboot/aspnetcore noop saas 客户端同语义：空快照也算命中，Menus() 不抛）。
// 2026-08-27 起 demo 兜底删除：从未登录直接 GET /menus -> 503 miss。
let menuSnapshotWritten = false;

// OAuth 2.0 code→user 内存映射（authorize 时存，callback 取后失效，一次性防重放）。
// 放在 authExtraHandlers 数组外面：数组字面量不能含 const 声明。
//
// 注意：不能放模块顶层 Map —— MSW Service Worker 在跨页面导航后可能被浏览器
// 终止并重启（移动 Chrome 闲置 ~30s 就回收），模块顶层变量随之丢失，回跳时
// oauthCodes.get(code) 拿不到、回调报 INVALID_GRANT "code 不存在或已被使用"。
// 用 SW 可访问的 caches API 持久化：跨 SW 重启存活。
// Node 测试环境（msw/node 的 setupServer）没有 caches 全局，所以加个内存 Map fallback。
type OAuthCodeEntry = { user: typeof DEMO_USER; redirect_uri: string };
const OAUTH_CODES_CACHE = "lab-msw-oauth-codes";
const oauthCodeUrl = (code: string): string =>
  `https://lab-msw-internal/oauth-code/${encodeURIComponent(code)}`;
const fallbackCodes = new Map<string, OAuthCodeEntry>();

async function setOauthCode(code: string, data: OAuthCodeEntry): Promise<void> {
  if (typeof caches !== "undefined") {
    const cache = await caches.open(OAUTH_CODES_CACHE);
    await cache.put(
      oauthCodeUrl(code),
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    return;
  }
  fallbackCodes.set(code, data);
}

async function getOauthCode(code: string): Promise<OAuthCodeEntry | null> {
  if (typeof caches !== "undefined") {
    const cache = await caches.open(OAUTH_CODES_CACHE);
    const response = await cache.match(oauthCodeUrl(code));
    if (!response) return null;
    return (await response.json()) as OAuthCodeEntry;
  }
  return fallbackCodes.get(code) ?? null;
}

async function deleteOauthCode(code: string): Promise<void> {
  if (typeof caches !== "undefined") {
    const cache = await caches.open(OAUTH_CODES_CACHE);
    await cache.delete(oauthCodeUrl(code));
    return;
  }
  fallbackCodes.delete(code);
}

// === /api/saas/* 端点不再由 lab-msw 兜底 ===
// dev 期由 lab-react / lab-vue 的 vite.config.ts server.proxy 转发到 saas:3000
// （同源避开浏览器 CORS preflight）。saas 返回真实菜单数据，本仓不必再镜像。
// saas 不可达时客户端 useSaasMenus() 自动降级到静态 MENU_TREE 兜底。


export const authExtraHandlers = [
  http.post(`*${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return HttpResponse.json(
        { code: "BAD_REQUEST", message: "username and password are required" },
        { status: 400 },
      );
    }
    if (password !== DEMO_PASSWORD || username !== DEMO_USER.username) {
      return HttpResponse.json(
        { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
        { status: 401 },
      );
    }
    // 与 springboot/aspnetcore Login() 同语义：成功后写菜单快照占位（msw 不真调
    // saas /me/menus，空数组即命中，Menus() 不抛 503）。
    menuSnapshotWritten = true;
    return HttpResponse.json({
      token: await signAccessToken({ sub: DEMO_USER.id, tenant_id: currentTenantId }),
      refreshToken: `lab-rt-${DEMO_USER.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      user: DEMO_USER,
      tenants,
    });
  }),

  // ADR-0019：未登录态直打 = 401（与 2026-08-27 msw demo 兜底删除原则对齐）。
  http.post(`${BASE}/auth/refresh`, async ({ request }) => {
    const claims = await requireBearer(request);
    if (!claims) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      token: await signAccessToken({ sub: claims.sub, tenant_id: claims.tenant_id || currentTenantId }),
      refreshToken: `lab-rt-${claims.sub}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      user: DEMO_USER,
      tenants,
    });
  }),

  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  // M00.F01 当前用户会话（用户 + 关联租户 + 当前选中）
  http.get(`${BASE}/auth/me`, async ({ request }) => {
    const claims = await requireBearer(request);
    if (!claims) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
        { status: 401 },
      );
    }
    return HttpResponse.json({ user: DEMO_USER, tenants, currentTenantId });
  }),

  // M00.F02 选租户：换发 token（msw 简化：只更新 currentTenantId 常量）
  http.post(`${BASE}/auth/switch-tenant`, async ({ request }) => {
    const claims = await requireBearer(request);
    if (!claims) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
        { status: 401 },
      );
    }
    const body = (await request.json()) as { tenantId?: string };
    const tid = String(body.tenantId ?? "");
    if (!tenants.some((tn) => tn.tenantId === tid)) {
      return HttpResponse.json({ code: "NOT_FOUND", message: "Tenant not found" }, { status: 404 });
    }
    currentTenantId = tid;
    return HttpResponse.json({
      token: await signAccessToken({ sub: claims.sub, tenant_id: tid }),
      refreshToken: `lab-rt-${claims.sub}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      user: DEMO_USER,
      tenants,
    });
  }),

  http.get(`${BASE}/auth/permissions`, () =>
    HttpResponse.json({
      permissions: [
        "contract:read",
        "contract:write",
        "sample:read",
        "sample:write",
        "report:read",
        "report:write",
        "report:issue",
        "inspection:read",
        "inspection:write",
        "audit:read",
        "*",
      ],
    }),
  ),

  // M01.F04.I01 动态菜单（2026-08-27 demo 兜底删除）：
  //   - miss（无快照 / 缓存过期 / 重启） → 503 MENUS_UNAVAILABLE，
  //     与 lab-springboot / lab-aspnetcore / lab-nextjs 后端同语义
  //   - 命中（login 写过的占位空快照） → 200 []，前端 useBackendMenus 失败回退静态
  // 路径用 `*${BASE}/...` 通配符（msw/node 测试栈下 orval `*/api/...` 比 extra
  // 相对路径 `/api/...` 优先级高，会抢走兜底；通配符对齐两边均生效）。
  http.get(`*${BASE}/auth/menus`, () => {
    if (!menuSnapshotWritten) {
      return HttpResponse.json(
        {
          code: "MENUS_UNAVAILABLE",
          message: "menu snapshot unavailable; re-login to refresh",
        },
        { status: 503 },
      );
    }
    return HttpResponse.json([]);
  }),

  // SSO → saas 身份平台走 OAuth 2.0 授权码模式（RFC 6749）
  //   authorize 收 {response_type=code, client_id, redirect_uri, state}，
  //   生成一次性 code 存内存映射（authorize→callback 用），返 authorizeUrl
  //   （dev mock：直接跳回 lab 的 redirect_uri 带 code+state，模拟 saas 已登录态；
  //    生产 saas 会真要求登录再回跳）。
  //   callback 收 {grant_type=authorization_code, code, redirect_uri}，验 code 映射
  //   + redirect_uri 一致后返 LoginResponse（lab 自家 token 形态 — msw 不真签 JWT，
  //    用 mock-jwt-<uid> 字符串）。
  // dev mock 不验 client_secret（生产 msw 仓不存在，springboot/aspnetcore 真后端验）。

  http.get(`*${BASE}/auth/sso/authorize`, async ({ request }) => {
    const url = new URL(request.url);
    const response_type = url.searchParams.get("response_type");
    const client_id = url.searchParams.get("client_id");
    const redirect_uri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    if (!response_type || !client_id || !redirect_uri || !state) {
      return HttpResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "OAuth 2.0 authorize: 缺必填字段（response_type/client_id/redirect_uri/state）",
        },
        { status: 400 },
      );
    }
    if (response_type !== "code") {
      return HttpResponse.json(
        {
          code: "UNSUPPORTED_RESPONSE_TYPE",
          message: "仅支持 response_type=code（授权码模式）",
        },
        { status: 400 },
      );
    }
    // 生成一次性 code + 存映射（callback 取后失效）
    const code = `mock-code-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await setOauthCode(code, { user: DEMO_USER, redirect_uri });
    // dev mock 直接构造 redirect_uri 带 code/state 跳回的 URL
    const back = new URL(redirect_uri);
    back.searchParams.set("code", code);
    back.searchParams.set("state", state);
    return HttpResponse.json({
      authorizeUrl: back.toString(),
      state,
    });
  }),

  http.post(`*${BASE}/auth/sso/callback`, async ({ request }) => {
    const body = (await request.json()) as {
      grant_type?: string;
      code?: string;
      redirect_uri?: string;
    };
    if (!body.grant_type || !body.code || !body.redirect_uri) {
      return HttpResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "OAuth 2.0 callback: 缺必填字段（grant_type/code/redirect_uri）",
        },
        { status: 400 },
      );
    }
    if (body.grant_type !== "authorization_code") {
      return HttpResponse.json(
        {
          code: "UNSUPPORTED_GRANT_TYPE",
          message: "仅支持 grant_type=authorization_code",
        },
        { status: 400 },
      );
    }
    const entry = await getOauthCode(body.code);
    if (!entry) {
      return HttpResponse.json(
        { code: "INVALID_GRANT", message: "code 不存在或已被使用" },
        { status: 400 },
      );
    }
    if (entry.redirect_uri !== body.redirect_uri) {
      return HttpResponse.json(
        { code: "INVALID_GRANT", message: "redirect_uri 与 authorize 时不一致" },
        { status: 400 },
      );
    }
    // code 一次性：取出后立即删除（防重放）
    await deleteOauthCode(body.code);
    return HttpResponse.json({
      token: await signAccessToken({ sub: entry.user.id, tenant_id: currentTenantId }),
      refreshToken: `lab-rt-${entry.user.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      user: entry.user,
      tenants,
    });
  }),
];

// === M02.F01 — Contracts CRUD ===
export const contractsExtraHandlers = [
  http.get(`${BASE}/contracts`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const keyword = url.searchParams.get("keyword") ?? "";
    let items = byTenant(contracts);
    if (status) items = items.filter((c) => c.status === status);
    if (keyword) items = items.filter((c) => c.contractCode.includes(keyword) || c.projectName.includes(keyword));
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    return HttpResponse.json(pageOf(items, page, pageSize));
  }),

  http.get(`${BASE}/contracts/:id`, ({ params }) => {
    const c = getContract(String(params.id));
    return c ? HttpResponse.json(c) : notFound("Contract not found");
  }),

  http.post(`${BASE}/contracts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newContract = {
      id: newId("CONTRACT"),
      contractCode: String(body.contractCode ?? ""),
      clientUnit: String(body.clientUnit ?? ""),
      projectName: String(body.projectName ?? ""),
      constructionUnit: String(body.constructionUnit ?? ""),
      witnessUnit: String(body.witnessUnit ?? ""),
      witness: String(body.witness ?? ""),
      status: (body.status as "active" | "archived") ?? "active",
      createdAt: NOW(),
      updatedAt: NOW(),
      ...body,
      // 租户归属由会话决定（list 按 byTenant 过滤；不落 tenantId 的行对列表不可见——
      // 2026-09-13 e2e 首轮抓出的真 bug），客户端传值不覆盖
      tenantId: currentTenantId,
    };
    contracts.push(newContract as never);
    return HttpResponse.json(newContract, { status: 201 });
  }),

  http.put(`${BASE}/contracts/:id`, async ({ params, request }) => {
    const c = getContract(String(params.id));
    if (!c) return notFound("Contract not found");
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(c, body, { updatedAt: NOW() });
    return HttpResponse.json(c);
  }),

  http.delete(`${BASE}/contracts/:id`, ({ params }) => {
    const i = contracts.findIndex((c) => c.id === params.id);
    if (i < 0) return notFound("Contract not found");
    contracts.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// === M03.F01/F02/F09 — SampleReceipts CRUD + task + history ===
export const receiptsExtraHandlers = [
  http.get(`${BASE}/receipts`, ({ request }) => {
    const url = new URL(request.url);
    const flowStatus = url.searchParams.get("flowStatus") as FlowStatus | null;
    const filter = url.searchParams.get("filter");
    const contractId = url.searchParams.get("contractId");
    const lastSubmittedBy = url.searchParams.get("lastSubmittedBy");
    const keyword = url.searchParams.get("keyword") ?? "";
    let items = byTenant(sampleReceipts);
    // 三态过滤器（FlowStagePage）：语义相对 flowStatus 环节--
    //   not_yet   = 停在本环节待提交（无 flowStatus 时=无流转记录的新单）
    //   submitted = 已从本环节 submit 至下一环节（history 有 submit from 本环节且当前不在本环节）；
    //               无 flowStatus 时=有流转记录且记录了提交人
    if (filter === "not_yet") {
      items = flowStatus
        ? items.filter((r) => r.flowStatus === flowStatus)
        : items.filter((r) => r.flowHistory.length === 0);
    } else if (filter === "submitted") {
      items = flowStatus
        ? items.filter(
            (r) =>
              r.flowStatus !== flowStatus &&
              r.flowHistory.some((h) => h.action === "submit" && h.from === flowStatus),
          )
        : items.filter((r) => r.flowHistory.length > 0 && !!r.lastSubmittedBy);
    } else if (flowStatus) {
      items = items.filter((r) => r.flowStatus === flowStatus);
    }
    if (contractId) items = items.filter((r) => r.contractId === contractId);
    if (lastSubmittedBy) items = items.filter((r) => r.lastSubmittedBy === lastSubmittedBy);
    if (keyword) items = items.filter((r) => r.commissionCode.includes(keyword));
    // newest-first（家族约定，同 audit 列表 occurred_at DESC）：seed 由 flow-matrix
    // 派生 210 条，pageOf 截断后 page1-only 的列表视图看不到新建行——
    // 2026-09-13 e2e 首轮抓出，倒序让新建行落回第一页。
    items = [...items].sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
    );
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    return HttpResponse.json(pageOf(items, page, pageSize));
  }),

  http.get(`${BASE}/receipts/:id`, ({ params }) => {
    const r = getReceipt(String(params.id));
    return r ? HttpResponse.json(r) : notFound("Receipt not found");
  }),

  http.post(`${BASE}/receipts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newReceipt = {
      id: newId("RECEIPT"),
      contractId: String(body.contractId ?? ""),
      commissionCode: String(body.commissionCode ?? ""),
      commissionDate: String(body.commissionDate ?? ""),
      categoryCode: String(body.categoryCode ?? ""),
      receivedBy: String(body.receivedBy ?? ""),
      sampleSource: String(body.sampleSource ?? ""),
      testCategory: String(body.testCategory ?? ""),
      flowStatus: "receiving",
      flowHistory: [],
      createdAt: NOW(),
      updatedAt: NOW(),
      ...body,
      tenantId: currentTenantId, // 同 contracts POST：list byTenant 过滤，见上
    };
    sampleReceipts.push(newReceipt as never);
    return HttpResponse.json(newReceipt, { status: 201 });
  }),

  http.put(`${BASE}/receipts/:id`, async ({ params, request }) => {
    const r = getReceipt(String(params.id));
    if (!r) return notFound("Receipt not found");
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(r, body, { updatedAt: NOW() });
    return HttpResponse.json(r);
  }),

  http.delete(`${BASE}/receipts/:id`, ({ params }) => {
    const i = sampleReceipts.findIndex((r) => r.id === params.id);
    if (i < 0) return notFound("Receipt not found");
    sampleReceipts.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // M03.F02 任务分配 / 取消
  http.put(`${BASE}/receipts/:id/task`, async ({ params, request }) => {
    const r = getReceipt(String(params.id));
    if (!r) return notFound("Receipt not found");
    const body = (await request.json()) as { assigneeId?: string; assigneeName?: string; plannedTestDate?: string };
    Object.assign(r, body, { updatedAt: NOW() });
    return HttpResponse.json(r);
  }),

  // M03.F09 流程历史
  http.get(`${BASE}/receipts/:id/history`, ({ params }) => {
    const r = getReceipt(String(params.id));
    return r ? HttpResponse.json(r.flowHistory) : notFound("Receipt not found");
  }),
];

// === M03.F05-F08 — Report flow (submit/return/withdraw + queue) ===
function nextStatus(current: FlowStatus): FlowStatus | undefined {
  const i = FLOW_ORDER.indexOf(current);
  return i >= 0 && i < FLOW_ORDER.length - 1 ? FLOW_ORDER[i + 1] : undefined;
}
function prevStatus(current: FlowStatus): FlowStatus | undefined {
  const i = FLOW_ORDER.indexOf(current);
  return i > 0 ? FLOW_ORDER[i - 1] : undefined;
}

export const reportFlowExtraHandlers = [
  http.post(`${BASE}/receipts/flow`, async ({ request }) => {
    const body = (await request.json()) as {
      ids: string[];
      action: FlowAction;
      operator: string;
      reason?: string;
    };
    const results = body.ids.map((id) => {
      const r = getReceipt(id);
      if (!r) return { id, ok: false, message: "Receipt not found" };
      const entry = {
        action: body.action,
        from: r.flowStatus,
        to: r.flowStatus,
        operator: body.operator,
        at: NOW(),
        reason: body.reason,
      };
      if (body.action === "submit") {
        const ns = nextStatus(r.flowStatus);
        if (!ns) return { id, ok: false, message: "Already at final stage" };
        entry.to = ns;
        r.flowStatus = ns;
        r.lastSubmittedBy = body.operator;
        if (ns === "issuance") r.issuedAt = NOW();
        if (ns === "completed") r.result = r.result || "pass";
      } else if (body.action === "return") {
        const ps = prevStatus(r.flowStatus);
        if (!ps) return { id, ok: false, message: "Already at first stage" };
        entry.to = ps;
        r.flowStatus = ps;
      } else {
        // withdraw: no-op on status (前端自行决定）
        return { id, ok: true, flowStatus: r.flowStatus };
      }
      r.flowHistory.push(entry);
      r.updatedAt = NOW();
      return { id, ok: true, flowStatus: r.flowStatus };
    });
    return HttpResponse.json(results);
  }),

  http.get(`${BASE}/receipts/flow/queue`, ({ request }) => {
    const url = new URL(request.url);
    const stage = url.searchParams.get("stage") as FlowStatus | null;
    const items = stage ? sampleReceipts.filter((r) => r.flowStatus === stage) : sampleReceipts;
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    return HttpResponse.json(pageOf(items, page, pageSize));
  }),
];

// === M03.F03 — Samples CRUD ===
export const samplesExtraHandlers = [
  http.get(`${BASE}/samples`, ({ request }) => {
    const url = new URL(request.url);
    const receiptId = url.searchParams.get("receiptId");
    let items = byTenant(samples);
    if (receiptId) items = items.filter((s) => s.receiptId === receiptId);
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    return HttpResponse.json(pageOf(items, page, pageSize));
  }),

  http.get(`${BASE}/samples/:id`, ({ params }) => {
    const s = getSample(String(params.id));
    return s ? HttpResponse.json(s) : notFound("Sample not found");
  }),

  http.post(`${BASE}/samples`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newSample = {
      id: newId("SAMPLE"),
      receiptId: String(body.receiptId ?? ""),
      sampleCode: String(body.sampleCode ?? ""),
      ext: body.ext ?? {},
      createdAt: NOW(),
      updatedAt: NOW(),
      ...body,
      tenantId: currentTenantId, // 同 contracts POST：list byTenant 过滤
    };
    samples.push(newSample as never);
    return HttpResponse.json(newSample, { status: 201 });
  }),

  http.put(`${BASE}/samples/:id`, async ({ params, request }) => {
    const s = getSample(String(params.id));
    if (!s) return notFound("Sample not found");
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(s, body, { updatedAt: NOW() });
    return HttpResponse.json(s);
  }),

  http.delete(`${BASE}/samples/:id`, ({ params }) => {
    const i = samples.findIndex((s) => s.id === params.id);
    if (i < 0) return notFound("Sample not found");
    samples.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// === M03.F03 — TestRecords CRUD + verdict ===
export const testRecordsExtraHandlers = [
  http.get(`${BASE}/test-records`, ({ request }) => {
    const url = new URL(request.url);
    const sampleId = url.searchParams.get("sampleId");
    const receiptId = url.searchParams.get("receiptId");
    let items = byTenant(testRecords);
    if (sampleId) items = items.filter((t) => t.sampleId === sampleId);
    if (receiptId) {
      // receipt_id 不在 test_records 列上（fixtures/DB 都无），用 samples 反查 sampleId 集合
      // —— 与 src/app/api/test-records/route.ts:16-19 同款。data_entry+ 详情页靠这个出检测数据。
      const sids = new Set(byTenant(samples).filter((s) => s.receiptId === receiptId).map((s) => s.id));
      items = items.filter((t) => sids.has(t.sampleId));
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    return HttpResponse.json(pageOf(items, page, pageSize));
  }),

  http.get(`${BASE}/test-records/:id`, ({ params }) => {
    const t = getTestRecord(String(params.id));
    return t ? HttpResponse.json(t) : notFound("TestRecord not found");
  }),

  http.post(`${BASE}/test-records`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newRec = {
      id: newId("TR"),
      sampleId: String(body.sampleId ?? ""),
      parameterCode: String(body.parameterCode ?? ""),
      requirement: String(body.requirement ?? ""),
      result: String(body.result ?? ""),
      createdAt: NOW(),
      updatedAt: NOW(),
      ...body,
      tenantId: currentTenantId, // 同 contracts POST：list byTenant 过滤
    };
    testRecords.push(newRec as never);
    return HttpResponse.json(newRec, { status: 201 });
  }),

  http.put(`${BASE}/test-records/:id`, async ({ params, request }) => {
    const t = getTestRecord(String(params.id));
    if (!t) return notFound("TestRecord not found");
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(t, body, { updatedAt: NOW() });
    return HttpResponse.json(t);
  }),

  http.delete(`${BASE}/test-records/:id`, ({ params }) => {
    const i = testRecords.findIndex((t) => t.id === params.id);
    if (i < 0) return notFound("TestRecord not found");
    testRecords.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // M03.F03.I11 人工改判（原 M03.F03.I06，2026-09-18 编号错位收敛已废弃并迁至 I11；PATCH /test-records/{id}/verdict 同 shared tsp）
  http.patch(`${BASE}/test-records/:id/verdict`, async ({ params, request }) => {
    const t = getTestRecord(String(params.id));
    if (!t) return notFound("TestRecord not found");
    const body = (await request.json()) as { verdict: string };
    t.verdict = body.verdict;
    t.updatedAt = NOW();
    return HttpResponse.json(t);
  }),
];

// === M04.F06-F09 — Catalog CRUD (4 tables homomorphic) ===
function catalogHandlers(
  plural: string,
  ops: { list: (o?: string) => CatalogEntry[]; get: (c: string) => CatalogEntry | undefined },
  arr: CatalogEntry[],
) {
  const base = `${BASE}/catalog/${plural}`;
  return [
    http.get(base, ({ request }) => {
      const url = new URL(request.url);
      const obj = url.searchParams.get("inspectionObjectCode") ?? undefined;
      const items = ops.list(obj);
      // shared TypeSpec `Page<T>` 4 字段对齐：items/page/pageSize/total
      return HttpResponse.json(pageOf(items, 1, items.length || 1));
    }),
    http.post(base, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const entry = {
        code: String(body.code ?? ""),
        name: String(body.name ?? ""),
        sortOrder: Number(body.sortOrder ?? 0),
        createdAt: NOW(),
        updatedAt: NOW(),
        ...body,
      } as CatalogEntry;
      arr.push(entry);
      return HttpResponse.json(entry, { status: 201 });
    }),
    http.put(`${base}/:code`, async ({ params, request }) => {
      const e = ops.get(String(params.code));
      if (!e) return notFound("Entry not found");
      const body = (await request.json()) as Record<string, unknown>;
      Object.assign(e, body, { updatedAt: NOW() });
      return HttpResponse.json(e);
    }),
    http.delete(`${base}/:code`, ({ params }) => {
      const i = arr.findIndex((e) => e.code === params.code);
      if (i < 0) return notFound("Entry not found");
      arr.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

export const catalogExtraHandlers = [
  ...catalogHandlers("brands", brandOps, inspectionBrands),
  ...catalogHandlers("models", modelOps, inspectionModels),
  ...catalogHandlers("specs", specOps, inspectionSpecs),
  ...catalogHandlers("grades", gradeOps, inspectionGrades),
];

// === M04.F05 — TechnicalRequirements CRUD ===
export const techReqExtraHandlers = [
  http.get(`${BASE}/technical-requirements`, ({ request }) => {
    const url = new URL(request.url);
    const obj = url.searchParams.get("inspectionObjectCode");
    const param = url.searchParams.get("inspectionParameterCode");
    let items = technicalRequirements;
    if (obj) items = items.filter((t) => t.inspectionObjectCode === obj);
    if (param) items = items.filter((t) => t.inspectionParameterCode === param);
    return HttpResponse.json(items);
  }),

  http.get(
    `${BASE}/technical-requirements/:inspectionObjectCode/:inspectionParameterCode/:judgmentStandardCode`,
    ({ params }) => {
      const t = technicalRequirements.find(
        (r) =>
          r.inspectionObjectCode === params.inspectionObjectCode &&
          r.inspectionParameterCode === params.inspectionParameterCode &&
          r.judgmentStandardCode === params.judgmentStandardCode,
      );
      return t ? HttpResponse.json(t) : notFound("TechnicalRequirement not found");
    },
  ),

  http.post(`${BASE}/technical-requirements`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const entry = {
      inspectionObjectCode: String(body.inspectionObjectCode ?? ""),
      inspectionParameterCode: String(body.inspectionParameterCode ?? ""),
      judgmentStandardCode: String(body.judgmentStandardCode ?? ""),
      valueType: body.valueType ?? "numeric",
      comparison: body.comparison ?? "≥",
      judgmentMode: body.judgmentMode ?? "manual",
      verificationStatus: body.verificationStatus ?? "draft",
      sortOrder: Number(body.sortOrder ?? 0),
      createdAt: NOW(),
      updatedAt: NOW(),
      ...body,
    } as TechnicalRequirement;
    technicalRequirements.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.put(
    `${BASE}/technical-requirements/:inspectionObjectCode/:inspectionParameterCode/:judgmentStandardCode`,
    async ({ params, request }) => {
      const t = technicalRequirements.find(
        (r) =>
          r.inspectionObjectCode === params.inspectionObjectCode &&
          r.inspectionParameterCode === params.inspectionParameterCode &&
          r.judgmentStandardCode === params.judgmentStandardCode,
      );
      if (!t) return notFound("TechnicalRequirement not found");
      const body = (await request.json()) as Record<string, unknown>;
      Object.assign(t, body, { updatedAt: NOW() });
      return HttpResponse.json(t);
    },
  ),

  http.delete(
    `${BASE}/technical-requirements/:inspectionObjectCode/:inspectionParameterCode/:judgmentStandardCode`,
    ({ params }) => {
      const i = technicalRequirements.findIndex(
        (r) =>
          r.inspectionObjectCode === params.inspectionObjectCode &&
          r.inspectionParameterCode === params.inspectionParameterCode &&
          r.judgmentStandardCode === params.judgmentStandardCode,
      );
      if (i < 0) return notFound("TechnicalRequirement not found");
      technicalRequirements.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    },
  ),
];

// === M06 — 检测能力字典（专项/项目/参数/标准 CRUD + junction link/unlink）===
// 4 主表 CRUD + 报告名称 CRUD + 计算方法 CRUD + 参数界面 CRUD + 所有 junction link/unlink。
// junction 用 body 匹配删除（DELETE 无 path id）。
function dictCrud<T extends { code: string }>(
  base: string,
  arr: T[],
  get: (code: string) => T | undefined,
  label: string,
  // wrap=true 时 GET 返 `Page<T>`（items/page/pageSize/total），
  // 与 shared TypeSpec `Page<T>` 对齐；默认 false 保持裸数组（catalog/report-names 等
  // OpenAPI 仍是 `T[]` 的端点继续走裸数组，避免被 frontend 误判）。
  wrap: boolean = false,
) {
  return [
    http.get(base, () =>
      wrap ? HttpResponse.json(pageOf(arr, 1, arr.length || 1)) : HttpResponse.json(arr),
    ),
    http.post(base, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const entry = { createdAt: NOW(), updatedAt: NOW(), ...body } as unknown as T;
      arr.push(entry);
      return HttpResponse.json(entry, { status: 201 });
    }),
    http.put(`${base}/:code`, async ({ params, request }) => {
      const e = get(String(params.code));
      if (!e) return notFound(`${label} not found`);
      const body = (await request.json()) as Record<string, unknown>;
      Object.assign(e, body, { updatedAt: NOW() });
      return HttpResponse.json(e);
    }),
    http.delete(`${base}/:code`, ({ params }) => {
      const i = arr.findIndex((x) => x.code === params.code);
      if (i < 0) return notFound(`${label} not found`);
      arr.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

export const dictionaryExtraHandlers = [
  // M06.F01 专项（OpenAPI `Page<T>`，list 返 items+page+pageSize+total）
  ...dictCrud(`${BASE}/inspection/specialties`, inspectionSpecialties as unknown as { code: string }[], getSpecialty as (c: string) => { code: string } | undefined, "Specialty", true),
  // M06.F02 项目（OpenAPI `Page<T>`）
  ...dictCrud(`${BASE}/inspection/objects`, inspectionObjects as unknown as { code: string }[], getObject as (c: string) => { code: string } | undefined, "Object", true),
  // M06.F03 参数（OpenAPI `Page<T>`）
  ...dictCrud(`${BASE}/inspection/parameters`, inspectionParameters as unknown as { code: string }[], getParameter as (c: string) => { code: string } | undefined, "Parameter", true),
  // M06.F04 标准（带 query 过滤；不复用 dictCrud 因为它不支持 URL 参数；OpenAPI `Page<T>`）
  http.get(`${BASE}/inspection/standards`, ({ request }) => {
    const url = new URL(request.url);
    const objectCode = url.searchParams.get("inspectionObjectCode");
    const parameterCode = url.searchParams.get("inspectionParameterCode");
    let allowed: Set<string> | null = null;
    if (objectCode) {
      allowed = new Set(
        inspectionObjectStandards
          .filter((l) => l.inspectionObjectCode === objectCode)
          .map((l) => l.inspectionStandardCode),
      );
    } else if (parameterCode) {
      allowed = new Set(
        inspectionStandardParameters
          .filter((l) => l.inspectionParameterCode === parameterCode)
          .map((l) => l.inspectionStandardCode),
      );
    }
    const items = allowed
      ? inspectionStandards.filter((s) => allowed!.has((s as { code: string }).code))
      : inspectionStandards;
    return HttpResponse.json(pageOf(items, 1, items.length || 1));
  }),
  http.post(`${BASE}/inspection/standards`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const entry = { createdAt: NOW(), updatedAt: NOW(), ...body } as never;
    inspectionStandards.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),
  http.put(`${BASE}/inspection/standards/:code`, async ({ params, request }) => {
    const e = getStandard(String(params.code));
    if (!e) return notFound("Standard not found");
    Object.assign(e, (await request.json()) as Record<string, unknown>, { updatedAt: NOW() });
    return HttpResponse.json(e);
  }),
  http.delete(`${BASE}/inspection/standards/:code`, ({ params }) => {
    const i = inspectionStandards.findIndex((s: { code: string }) => s.code === params.code);
    if (i < 0) return notFound("Standard not found");
    inspectionStandards.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── junction link/unlink（4 类）──
  // GET 列表（OpenAPI `Page<T>`）：先于 link/unlink 注册，便于 path-only pattern 命中
  // `*` 前缀与 templates handlers 同款：msw 2.15 dev build 下 path-only pattern 匹配不到绝对 URL
  http.get(`*${BASE}/inspection/links/specialty-object`, ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("inspectionSpecialtyCode");
    const items = code
      ? inspectionSpecialtyObjects.filter((l) => l.inspectionSpecialtyCode === code)
      : inspectionSpecialtyObjects;
    return HttpResponse.json(pageOf(items, 1, items.length || 1));
  }),
  http.post(`${BASE}/inspection/links/specialty-object`, async ({ request }) => {
    inspectionSpecialtyObjects.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/inspection/links/specialty-object`, async ({ request }) => {
    const b = (await request.json()) as { inspectionSpecialtyCode: string; inspectionObjectCode: string };
    const i = inspectionSpecialtyObjects.findIndex(
      (l) => l.inspectionSpecialtyCode === b.inspectionSpecialtyCode && l.inspectionObjectCode === b.inspectionObjectCode,
    );
    if (i >= 0) inspectionSpecialtyObjects.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`*${BASE}/inspection/links/object-parameter`, ({ request }) => {
    const url = new URL(request.url);
    const objCode = url.searchParams.get("inspectionObjectCode");
    const paramCode = url.searchParams.get("inspectionParameterCode");
    let items = inspectionObjectParameters;
    if (objCode) items = items.filter((l) => l.inspectionObjectCode === objCode);
    if (paramCode) items = items.filter((l) => l.inspectionParameterCode === paramCode);
    return HttpResponse.json(pageOf(items, 1, items.length || 1));
  }),
  http.post(`${BASE}/inspection/links/object-parameter`, async ({ request }) => {
    inspectionObjectParameters.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/inspection/links/object-parameter`, async ({ request }) => {
    const b = (await request.json()) as { inspectionObjectCode: string; inspectionParameterCode: string };
    const i = inspectionObjectParameters.findIndex(
      (l) => l.inspectionObjectCode === b.inspectionObjectCode && l.inspectionParameterCode === b.inspectionParameterCode,
    );
    if (i >= 0) inspectionObjectParameters.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`*${BASE}/inspection/links/object-standard`, ({ request }) => {
    const url = new URL(request.url);
    const objCode = url.searchParams.get("inspectionObjectCode");
    const role = url.searchParams.get("role");
    let items = inspectionObjectStandards;
    if (objCode) items = items.filter((l) => l.inspectionObjectCode === objCode);
    if (role) items = items.filter((l) => l.role === role);
    return HttpResponse.json(pageOf(items, 1, items.length || 1));
  }),
  http.post(`${BASE}/inspection/links/object-standard`, async ({ request }) => {
    inspectionObjectStandards.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/inspection/links/object-standard`, async ({ request }) => {
    const b = (await request.json()) as { inspectionObjectCode: string; inspectionStandardCode: string; role: string };
    const i = inspectionObjectStandards.findIndex(
      (l) => l.inspectionObjectCode === b.inspectionObjectCode && l.inspectionStandardCode === b.inspectionStandardCode && l.role === b.role,
    );
    if (i >= 0) inspectionObjectStandards.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // GET 列表（支持 standardCode/parameterCode 过滤；OpenAPI `Page<T>`）
  // `*` 前缀与 templates handlers 同款：msw 2.15 dev build 下 path-only pattern 匹配不到绝对 URL
  http.get(`*${BASE}/inspection/links/standard-parameter`, ({ request }) => {
    const url = new URL(request.url);
    const standardCode = url.searchParams.get("inspectionStandardCode");
    const parameterCode = url.searchParams.get("inspectionParameterCode");
    let items = inspectionStandardParameters;
    if (standardCode) items = items.filter((l) => l.inspectionStandardCode === standardCode);
    if (parameterCode) items = items.filter((l) => l.inspectionParameterCode === parameterCode);
    return HttpResponse.json(pageOf(items, 1, items.length || 1));
  }),
  http.post(`${BASE}/inspection/links/standard-parameter`, async ({ request }) => {
    inspectionStandardParameters.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/inspection/links/standard-parameter`, async ({ request }) => {
    const b = (await request.json()) as { inspectionStandardCode: string; inspectionParameterCode: string };
    const i = inspectionStandardParameters.findIndex(
      (l) => l.inspectionStandardCode === b.inspectionStandardCode && l.inspectionParameterCode === b.inspectionParameterCode,
    );
    if (i >= 0) inspectionStandardParameters.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// === M06.F05 计算方法 + M06.F07 报告名称 + M06.F08 参数界面 ===
export const m06ExtraHandlers = [
  // 报告名称 CRUD（M06.F07，OpenAPI `Page<T>`）
  ...dictCrud(`${BASE}/report-names`, inspectionReportNames as unknown as { code: string }[], getReportName as (c: string) => { code: string } | undefined, "ReportName", true),
  http.get(`${BASE}/report-names/:code`, ({ params }) => {
    const r = getReportName(String(params.code));
    return r ? HttpResponse.json(r) : notFound("ReportName not found");
  }),

  // 报告名称 junction link/unlink（3 类）
  http.post(`${BASE}/report-names/links/object`, async ({ request }) => {
    inspectionObjectReportNames.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/report-names/links/object`, async ({ request }) => {
    const b = (await request.json()) as { inspectionObjectCode: string; reportNameCode: string };
    const i = inspectionObjectReportNames.findIndex(
      (l) => l.inspectionObjectCode === b.inspectionObjectCode && l.reportNameCode === b.reportNameCode,
    );
    if (i >= 0) inspectionObjectReportNames.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // GET 列表（Page<T> 4 字段；支持 inspectionObjectCode/reportNameCode 过滤，镜像 shared listObjectReportNameLinks）
  http.get(`*${BASE}/report-names/links/object`, ({ request }) => {
    const url = new URL(request.url);
    const objectCode = url.searchParams.get("inspectionObjectCode");
    const reportNameCode = url.searchParams.get("reportNameCode");
    const items = inspectionObjectReportNames.filter(
      (l) => (!objectCode || l.inspectionObjectCode === objectCode) && (!reportNameCode || l.reportNameCode === reportNameCode),
    );
    return HttpResponse.json(pageOf(items, 1, items.length));
  }),
  // GET 列表（Page<T> 4 字段；支持 reportNameCode/role 过滤，镜像 shared TypeSpec listReportNameStandardLinks）
  http.get(`*${BASE}/report-names/links/standard`, ({ request }) => {
    const url = new URL(request.url);
    const reportNameCode = url.searchParams.get("reportNameCode");
    const role = url.searchParams.get("role");
    const items = inspectionReportNameStandards.filter(
      (l) => (!reportNameCode || l.reportNameCode === reportNameCode) && (!role || l.role === role),
    );
    return HttpResponse.json(pageOf(items, 1, items.length));
  }),
  http.post(`${BASE}/report-names/links/standard`, async ({ request }) => {
    inspectionReportNameStandards.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/report-names/links/standard`, async ({ request }) => {
    const b = (await request.json()) as { reportNameCode: string; inspectionStandardCode: string; role: string };
    const i = inspectionReportNameStandards.findIndex(
      (l) => l.reportNameCode === b.reportNameCode && l.inspectionStandardCode === b.inspectionStandardCode && l.role === b.role,
    );
    if (i >= 0) inspectionReportNameStandards.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // GET 列表（Page<T> 4 字段；支持 reportNameCode/inspectionParameterCode 过滤，镜像 shared listReportNameParameterLinks）
  http.get(`*${BASE}/report-names/links/parameter`, ({ request }) => {
    const url = new URL(request.url);
    const reportNameCode = url.searchParams.get("reportNameCode");
    const inspectionParameterCode = url.searchParams.get("inspectionParameterCode");
    const items = inspectionReportNameParameters.filter(
      (l) => (!reportNameCode || l.reportNameCode === reportNameCode) && (!inspectionParameterCode || l.inspectionParameterCode === inspectionParameterCode),
    );
    return HttpResponse.json(pageOf(items, 1, items.length));
  }),
  http.post(`${BASE}/report-names/links/parameter`, async ({ request }) => {
    inspectionReportNameParameters.push((await request.json()) as never);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${BASE}/report-names/links/parameter`, async ({ request }) => {
    const b = (await request.json()) as { reportNameCode: string; inspectionParameterCode: string };
    const i = inspectionReportNameParameters.findIndex(
      (l) => l.reportNameCode === b.reportNameCode && l.inspectionParameterCode === b.inspectionParameterCode,
    );
    if (i >= 0) inspectionReportNameParameters.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // 计算方法 CRUD（M06.F05，复合主键 object+parameter）
  http.get(`${BASE}/calculation-methods`, ({ request }) => {
    const url = new URL(request.url);
    const obj = url.searchParams.get("inspectionObjectCode");
    const param = url.searchParams.get("inspectionParameterCode");
    let items = inspectionCalculationMethods;
    if (obj) items = items.filter((r) => r.inspectionObjectCode === obj);
    if (param) items = items.filter((r) => r.inspectionParameterCode === param);
    return HttpResponse.json(items);
  }),
  http.post(`${BASE}/calculation-methods`, async ({ request }) => {
    const entry = { createdAt: NOW(), updatedAt: NOW(), ...((await request.json()) as object) } as never;
    inspectionCalculationMethods.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),
  http.get(`${BASE}/calculation-methods/:inspectionObjectCode/:inspectionParameterCode`, ({ params }) => {
    const r = getCalculationMethod(String(params.inspectionObjectCode), String(params.inspectionParameterCode));
    return r ? HttpResponse.json(r) : notFound("CalculationMethod not found");
  }),
  http.put(`${BASE}/calculation-methods/:inspectionObjectCode/:inspectionParameterCode`, async ({ params, request }) => {
    const r = getCalculationMethod(String(params.inspectionObjectCode), String(params.inspectionParameterCode));
    if (!r) return notFound("CalculationMethod not found");
    Object.assign(r, (await request.json()) as object, { updatedAt: NOW() });
    return HttpResponse.json(r);
  }),
  http.delete(`${BASE}/calculation-methods/:inspectionObjectCode/:inspectionParameterCode`, ({ params }) => {
    const i = inspectionCalculationMethods.findIndex(
      (r) => r.inspectionObjectCode === params.inspectionObjectCode && r.inspectionParameterCode === params.inspectionParameterCode,
    );
    if (i < 0) return notFound("CalculationMethod not found");
    inspectionCalculationMethods.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // 参数界面 CRUD（M06.F08）+ link/unlink —— 契约路径（REQ-2026-001：
  // 由 /api/inspection-param-interfaces 私生路径收敛，fixture 字段名对齐
  // 契约 ParamInterfaceLink.paramInterfaceCode）。本段接管 orval faker 兜底
  //（handlers-array.ts OVERRIDDEN_BY_EXTRA 同步过滤）。
  // ⚠️ links GET / DELETE 都必须放在 dictCrud（:code handler）之前，
  // 否则 "links" 被当 :code 吞掉（2026-09-14 live 四方实证：DELETE /links 404）
  http.get(`*${BASE}/param-interfaces/links`, ({ request }) => {
    const url = new URL(request.url);
    // 契约 query：inspectionParameterCode / paramInterfaceCode
    const code = url.searchParams.get("inspectionParameterCode");
    const interfaceCode = url.searchParams.get("paramInterfaceCode");
    const items = inspectionParamInterfaceLinks.filter(
      (l) => (!code || l.inspectionParameterCode === code) && (!interfaceCode || l.paramInterfaceCode === interfaceCode),
    );
    return HttpResponse.json(pageOf(items, 1, items.length));
  }),
  http.delete(`${BASE}/param-interfaces/links`, async ({ request }) => {
    // 契约 unlink 是 @body；query 兼容过渡期（前端 AssociationManager 双发）
    const url = new URL(request.url);
    let b: Record<string, unknown>;
    try {
      b = (await request.json()) as Record<string, unknown>;
    } catch {
      b = {
        inspectionParameterCode: url.searchParams.get("inspectionParameterCode"),
        paramInterfaceCode: url.searchParams.get("paramInterfaceCode"),
      };
    }
    const i = inspectionParamInterfaceLinks.findIndex(
      (l) => l.inspectionParameterCode === b["inspectionParameterCode"] && l.paramInterfaceCode === b["paramInterfaceCode"],
    );
    if (i >= 0) inspectionParamInterfaceLinks.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  ...dictCrud(`${BASE}/param-interfaces`, inspectionParamInterfaces as unknown as { code: string }[], getInspectionParamInterface as (c: string) => { code: string } | undefined, "InspectionParamInterface", true),
  http.get(`${BASE}/param-interfaces/:code`, ({ params }) => {
    const p = getInspectionParamInterface(String(params.code));
    return p ? HttpResponse.json(p) : notFound("InspectionParamInterface not found");
  }),
  http.post(`${BASE}/param-interfaces/links`, async ({ request }) => {
    const b = (await request.json()) as Record<string, unknown>;
    if (!b["inspectionParameterCode"] || !b["paramInterfaceCode"])
      return HttpResponse.json({ message: "inspectionParameterCode/paramInterfaceCode 必填" }, { status: 400 });
    const dup = inspectionParamInterfaceLinks.some(
      (l) =>
        l.inspectionParameterCode === b["inspectionParameterCode"] &&
        l.paramInterfaceCode === b["paramInterfaceCode"] &&
        (l.reportNameCode ?? undefined) === (b["reportNameCode"] ?? undefined),
    );
    if (dup)
      return HttpResponse.json({ message: "关联已存在" }, { status: 400 });
    const now = NOW();
    // b 的字段是 unknown：先收窄到 ParamInterfaceLink 的字段类型再入列
    // （直接 as 数组元素类型 TS2352 —— L3 类型门红根因）
    const row = {
      inspectionParameterCode: String(b["inspectionParameterCode"]),
      paramInterfaceCode: String(b["paramInterfaceCode"]),
      reportNameCode: b["reportNameCode"] === undefined ? undefined : String(b["reportNameCode"]),
      config: b["config"] as (typeof inspectionParamInterfaceLinks)[number]["config"],
      createdAt: now,
      updatedAt: now,
    } as (typeof inspectionParamInterfaceLinks)[number];
    inspectionParamInterfaceLinks.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  // （links GET / DELETE 均已上移到 dictCrud 之前——注册顺序防 :code 吞并）
];

// === M05.F01 — Summary + stats ===
export const summaryExtraHandlers = [
  http.get(`${BASE}/summary`, ({ request }) => {
    const url = new URL(request.url);
    const categoryCode = url.searchParams.get("categoryCode") ?? "ALL";
    const items = categoryCode === "ALL"
      ? sampleReceipts
      : sampleReceipts.filter((r) => r.categoryCode === categoryCode);
    return HttpResponse.json({
      summaryName: `报告汇总（${categoryCode}）`,
      columns: [
        { key: "commissionCode", label: "委托编号" },
        { key: "categoryCode", label: "报告类别" },
        { key: "projectName", label: "工程名称" },
        { key: "flowStatus", label: "流程状态" },
        { key: "result", label: "结论" },
        { key: "reportCode", label: "报告编号" },
      ],
      rows: items.map((r) => ({
        commissionCode: r.commissionCode,
        categoryCode: r.categoryCode,
        projectName: r.projectName ?? "",
        flowStatus: r.flowStatus,
        result: r.result ?? "",
        reportCode: r.reportCode ?? "",
      })),
    });
  }),

  http.get(`${BASE}/summary/stats`, () => {
    const byStatus = (s: FlowStatus) =>
      sampleReceipts.filter((r) => r.flowStatus === s).length;
    // ── M05.F01.I03 今日试验总数 ──
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTestCount = sampleReceipts.filter((r) => {
      const c = String(r.createdAt ?? "");
      const t = String(r.testStartDate ?? "");
      return c.startsWith(todayStr) || t === todayStr;
    }).length;
    // ── M05.F01.I03 按材料类型合格率 ──
    const MATERIAL_KEYWORDS: Record<string, string[]> = {
      concrete: ["混凝土", "水泥"],
      rebar: ["钢筋", "钢材", "焊接", "机械连接", "连接"],
      sand: ["砂", "碎（卵）石", "轻集料", "颗粒级配"],
    };
    function materialOf(categoryCode: string): keyof typeof MATERIAL_KEYWORDS | null {
      const rn = inspectionReportNames.find((r) => r.code === categoryCode);
      const name = rn?.summaryName ?? "";
      for (const [k, kws] of Object.entries(MATERIAL_KEYWORDS)) {
        if (kws.some((kw) => name.includes(kw))) return k as keyof typeof MATERIAL_KEYWORDS;
      }
      return null;
    }
    const qualifiedRateByMaterial: Record<
      string,
      { total: number; pass: number; rate: number }
    > = {
      concrete: { total: 0, pass: 0, rate: 0 },
      rebar: { total: 0, pass: 0, rate: 0 },
      sand: { total: 0, pass: 0, rate: 0 },
    };
    for (const r of sampleReceipts) {
      const mat = materialOf(r.categoryCode);
      if (!mat) continue;
      const e = qualifiedRateByMaterial[mat]!;
      e.total += 1;
      if (r.result === "pass") e.pass += 1;
    }
    for (const e of Object.values(qualifiedRateByMaterial)) {
      e.rate = e.total > 0 ? Math.round((e.pass / e.total) * 1000) / 1000 : 0;
    }
    // ── M05.F01.I03 报告产出量 ──
    const generatedCount = sampleReceipts.filter((r) => Boolean(r.reportCode)).length;
    const pendingCount = byStatus("review") + byStatus("approval");
    const issuedCount = byStatus("issuance") + byStatus("archived") + byStatus("completed");
    const reportOutputByStatus = {
      generated: generatedCount,
      pending: pendingCount,
      issued: issuedCount,
    };
    // ── M05.F01.I04 任务漏斗（6 段）──
    const dataEntryNoReport = sampleReceipts.filter(
      (r) => r.flowStatus === "data_entry" && !r.reportCode,
    ).length;
    const dataEntryWithReport = sampleReceipts.filter(
      (r) => r.flowStatus === "data_entry" && r.reportCode,
    ).length;
    const funnelByStage = {
      pending_collect: byStatus("receiving"),
      received: byStatus("task_assignment"),
      testing: dataEntryNoReport,
      reporting: dataEntryWithReport,
      reviewing: byStatus("review") + byStatus("approval"),
      issued: issuedCount,
    };
    return HttpResponse.json({
      contractCount: contracts.length,
      receiptCount: sampleReceipts.length,
      sampleCount: samples.length,
      reportCountByStatus: {
        draft: byStatus("receiving") + byStatus("task_assignment") + byStatus("data_entry"),
        reviewing: byStatus("review") + byStatus("approval"),
        issued: issuedCount,
      },
      pendingTaskCount: byStatus("task_assignment") + byStatus("data_entry") + byStatus("review"),
      todayTestCount,
      qualifiedRateByMaterial,
      reportOutputByStatus,
      funnelByStage,
    });
  }),
];

// === M06.Templates 端点已拆到 src/handlers-extra-templates.ts ===
// 模板 HTTP endpoint 用 readTemplate（node:fs/promises），只在 node 端
// setupServer 加载。browser 端走消费仓各自的 data/templates/ +
// import.meta.glob 读 docx，详见 handlers-extra-templates.ts 头注释。

export const extraHandlers = [
  ...authExtraHandlers,
  ...contractsExtraHandlers,
  ...receiptsExtraHandlers,
  ...reportFlowExtraHandlers,
  ...samplesExtraHandlers,
  ...testRecordsExtraHandlers,
  ...catalogExtraHandlers,
  ...techReqExtraHandlers,
  ...dictionaryExtraHandlers,
  ...m06ExtraHandlers,
  ...summaryExtraHandlers,
];
