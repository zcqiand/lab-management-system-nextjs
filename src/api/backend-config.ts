// 后端配置：env 单 URL + 4 后端运行时切换（2026-09-14 用户裁定，对齐 saas 家族）。
//
// ADR-0014 的 env 单 URL 仍是「未选择时」的默认目标；本文件新增 dev/local 诊断用的
// 运行时切换语义（localStorage key `lab.api.backend`，http-client 每请求动态读取，
// 切完下一请求即生效，无需刷新）。端口表 = multi-repo-family §6（lab = 520x 段）。

import { env } from "./env";

// prod 分流（saas 家族 2026-09-13 裁定同款）：prod 构建下选择映射到 prod 域名。
// lab 家族 prod 部署现状：msw（lab-msw.xiangru.uk）、nextjs-self（同源 ""）；
// aspnetcore / springboot 无 prod 部署 → SELECTABLE_BACKENDS 在 prod 构建剔除。
const IS_PROD_BUILD = process.env.NODE_ENV === "production";

export const BACKENDS = [
  { key: "msw", baseUrl: "http://localhost:5200", prodBaseUrl: "https://lab-msw.xiangru.uk" },
  { key: "nextjs-self", baseUrl: "", prodBaseUrl: "" },
  { key: "aspnetcore", baseUrl: "http://localhost:5204", prodBaseUrl: undefined },
  { key: "springboot", baseUrl: "http://localhost:5205", prodBaseUrl: undefined },
] as const;

// prod 构建下剔除无 prod 部署的项（aspnetcore / springboot）
export const SELECTABLE_BACKENDS = BACKENDS.filter(
  (b) => !IS_PROD_BUILD || b.prodBaseUrl !== undefined,
);

function resolveBaseUrl(b: (typeof BACKENDS)[number]): string {
  return (IS_PROD_BUILD && b.prodBaseUrl) || b.baseUrl;
}

/** 选择 key → 实际 base URL（prod 返回 prod 域名，dev 返回 localhost）。 */
export function resolveSelectedBackendUrl(key: string): string {
  const hit = BACKENDS.find((b) => b.key === key);
  return hit ? resolveBaseUrl(hit) : "";
}

const BACKEND_LS_KEY = "lab.api.backend";

// token 存储 key 的 SSOT（auth-context 消费）。放本文件而不是 auth-context：
// 切后端清 token 的逻辑在这层（见 setSelectedBackend），不能反向 import tsx。
export const TOKEN_STORAGE_KEY = "lab.token";

/** 当前选中的后端 key（"" = 未选择，走 env 默认）。SSR/localStorage 不可用返回 ""。 */
export function getSelectedBackend(): string {
  try {
    return globalThis.localStorage?.getItem(BACKEND_LS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSelectedBackend(key: string): void {
  try {
    const prev = globalThis.localStorage?.getItem(BACKEND_LS_KEY) ?? "";
    if (key) localStorage.setItem(BACKEND_LS_KEY, key);
    else localStorage.removeItem(BACKEND_LS_KEY);
    // 切后端 = 换验签方：旧后端铸的 token 对新后端必然无效（各家 JWT key /
    // aud 约定不互通——2026-09-15 事故：5205 自定义 key 铸的 token 带到 5204
    // 持续 401）。真切换时清掉，让登录页自愈链路对新后端重走 SSO；
    // 同值重复 set（dropdown 重选当前项）不清，避免误伤会话。
    if (key !== prev) localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* localStorage 不可用（SSR/隐私模式）：忽略 */
  }
}

export function getApiBaseUrl(): string {
  // 运行时切换优先；未选择时走 env。未知/已下线的 key（localStorage 跨构建遗留）
  // 命中失败 → 落 env 默认。env 空串合法（同源），不能 || 吞掉。
  const selected = getSelectedBackend();
  if (selected) {
    const hit = SELECTABLE_BACKENDS.find((b) => b.key === selected);
    if (hit) return resolveBaseUrl(hit);
  }
  return env.NEXT_PUBLIC_API_BASE_URL;
}

export function getApiMode(): string {
  // 显示标签跟随选中项（backend key）；未选择走 env 标签（env.ts 默认 msw-http）。
  const selected = getSelectedBackend();
  if (selected) {
    const hit = SELECTABLE_BACKENDS.find((b) => b.key === selected);
    if (hit) return hit.key;
  }
  return env.NEXT_PUBLIC_API_MODE || "msw-http";
}
