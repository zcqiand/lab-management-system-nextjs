// HTTP client — axios + 1:1 endpoint mapping via local orval codegen.
//
// 与 lab-react 的 http-client.ts 同款，但 nextjs 有 SSR 维度：
//   - 客户端组件：本文件 + .client.tsx 后缀消费方走 axios 拦截
//   - 服务端组件：直接用 pg client / 或走 fetch 拿 raw token
//
// 本仓库「nextjs 即后端」模式下，'nextjs' 模式的 baseUrl 是 ""，
// 客户端组件发出的 fetch/axios 会自动命中本仓 API routes（src/app/api/.../route.ts）。

import axios, { type AxiosError } from "axios";
import { getApiBaseUrl } from "./backend-config";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<unknown>;
    return new ApiError(axErr.response?.status ?? 0, axErr.response?.data ?? null, axErr.message);
  }
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(0, null, err.message);
  return new ApiError(0, null, String(err));
}

/**
 * 注入运行时 baseUrl + Bearer token。
 * 在 BootstrapClient mount 之前调一次（ClientLayout 的 Provider 内）。
 */
export function installHttpClient(getToken: () => string | null): void {
  axios.interceptors.request.use((config) => {
    if (!config.baseURL) {
      config.baseURL = getApiBaseUrl();
    }
    const token = getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
