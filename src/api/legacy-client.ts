"use client";
// REF api/client.ts 的移植形态：组件代码 import 这里，签名与 REF src/api/client.ts 一致。
// 路由经 API_ROUTES 映射到 lab-msw 当前 OpenAPI 路由（见计划 M1 表）。
import axios, { AxiosError, type AxiosInstance } from "axios";
import { getBaseUrl } from "./backend-config";
import { env } from "./env";

let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setToken(token: string | null) { currentToken = token; }
export function onUnauthorized(handler: () => void) { unauthorizedHandler = handler; }
export function resetApiClient() { currentToken = null; unauthorizedHandler = null; }

export const apiClient: AxiosInstance = axios.create({ baseURL: "" });
export const identityClient: AxiosInstance = axios.create({ baseURL: env.IDENTITY_BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (!config.baseURL) config.baseURL = getBaseUrl() || "";
  if (currentToken) config.headers.set("Authorization", `Bearer ${currentToken}`);
  return config;
});
identityClient.interceptors.request.use((config) => {
  if (currentToken) config.headers.set("Authorization", `Bearer ${currentToken}`);
  return config;
});
for (const client of [apiClient, identityClient]) {
  client.interceptors.response.use(
    (r) => r,
    (err: unknown) => {
      if (err instanceof AxiosError && err.response?.status === 401) unauthorizedHandler?.();
      return Promise.reject(err);
    },
  );
}

/**
 * REF 旧路由 → lab-msw OpenAPI v2 路由。键以 REF 源码出现过的字面量为准。
 * 值带 `/api` 前缀 —— shared/openapi.yaml 与 msw handlers（BASE="/api"）的
 * 真实路径形态；REF 仓 orval 生成的客户端同样以 `/api/...` 字面量调用。
 */
export const API_ROUTES = {
  "/audit-logs": "/api/audit-logs",
  "/auth/login": "/api/auth/login",
  "/auth/oauth/callback": "/api/auth/sso/callback",
  "/auth/permissions": "/api/auth/permissions",
  "/auth/menus": "/api/auth/menus",
  "/contracts": "/api/contracts",
  "/inspection-calculation-rules": "/api/calculation-rules",
  "/inspection-objects": "/api/inspection/objects",
  "/inspection-parameters": "/api/inspection/parameters",
  "/inspection-parameter-param-interfaces": "/api/param-interfaces/links",
  "/inspection-report-name-parameters": "/api/report-names/links/parameter",
  "/inspection-report-name-standards": "/api/report-names/links/standard",
  "/inspection-standard-parameters": "/api/inspection/links/standard-parameter",
  "/inspection-standards": "/api/inspection/standards",
  "/inspection-technical-requirements": "/api/technical-requirements",
  "/param-interfaces": "/api/param-interfaces",
  "/receipts": "/api/receipts",
  "/receipts/flow": "/api/receipts/flow",
  "/report-names": "/api/report-names",
  "/samples": "/api/samples",
  "/standard-parameters": "/api/inspection/links/standard-parameter",
  "/summary": "/api/summary",
  "/test-records": "/api/test-records",
  // —— Task 8 追加（SampleManagerModal 四码表 + ReportPreviewModal 机构信息）——
  // msw 暂无 /api/org-info handler：组件 catch 兜底为 null（REF 同行为）。
  "/models": "/api/catalog/models",
  "/specifications": "/api/catalog/specs",
  "/grades": "/api/catalog/grades",
  "/brands": "/api/catalog/brands",
  "/org-info": "/api/org-info",
  // —— Task 13 追加（M06 检测能力 10 组件）——
  // 4 主表 CRUD + 4 类 junction link。msw dictCrud 裸数组 → {items} 由
  // tests/helpers/seed.ts installShapeAdapters 包（同 Wave 2 前作模式）。
  "/inspection-specialties": "/api/inspection/specialties",
  "/inspection-specialty-objects": "/api/inspection/links/specialty-object",
  "/inspection-object-standards": "/api/inspection/links/object-standard",
  "/inspection-object-parameters": "/api/inspection/links/object-parameter",
  "/inspection-object-report-names": "/api/report-names/links/object",
} as const;
