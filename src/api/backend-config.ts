// 后端配置：env-driven 单 URL（ADR-0014）。
//
// 旧 4-backend 运行时切换（msw / aspnetcore / springboot / nextjs）+ localStorage 持久化 +
// Module 单例 + Context/Pinia 已废弃。改用：
//
//   NEXT_PUBLIC_API_BASE_URL   后端 base URL（默认 "http://localhost:5200" msw-http）
//   NEXT_PUBLIC_API_MODE       显示标签（默认 "msw-http"），仅 UI 显示，不参与路由
//
// ADR-0012 v0.3.0：Service Worker 模式完全删除。dev 路径只走 msw-http
//（独立 HTTP server，由 @lab/management-system-msw/src/server.ts 起在 :5200）；
// *_ENABLE_MSW env 与 isMswEnabled() 函数一并删除。
//
// 所有调用方从 `getBaseUrl()` / `getBackend()` 切到 `getApiBaseUrl()` / `getApiMode()`。
// 改动必须在 `function-tree.md` M98.F01 → 已废弃 批准之后（ADR-0014）。

import { env } from "./env";

export function getApiBaseUrl(): string {
  // 空串合法（测试同源相对 URL，见 env.ts）：默认值已在 env.ts 落过一次，
  // 这里再 || 会把空串吞回绝对 URL（msw 相对路径 handler 失配的根因之一）。
  return env.NEXT_PUBLIC_API_BASE_URL;
}

export function getApiMode(): string {
  return env.NEXT_PUBLIC_API_MODE || "msw-http";
}