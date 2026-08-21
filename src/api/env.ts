// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；默认 "http://localhost:5173" msw-http
//   NEXT_PUBLIC_API_MODE       显示标签；默认 "msw-http"
//
// ADR-0012 v0.3.0：删除 NEXT_PUBLIC_ENABLE_MSW（Service Worker 模式已删除）。
export const env = {
  IDENTITY_BASE_URL: process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api",
  APP_ID: process.env.NEXT_PUBLIC_APP_ID || "app-lab",
  SSO_AUTHORIZE_URL: process.env.NEXT_PUBLIC_SSO_AUTHORIZE_URL || "/sso/authorize",
  OAUTH_SCOPES: process.env.NEXT_PUBLIC_OAUTH_SCOPES || "",
  // 区分「未设」(undefined) 和「空串」(explicit empty) -- 镜像 lab-react readEnv：
  //   - 未设 -> fallback（dev 默认走 msw-http :5173）
  //   - 空串 -> ""（测试同源相对 URL，@lab/management-system-msw/node setupServer
  //     的相对路径 handler 才能匹配；|| 会把空串吞掉回退绝对 URL，只剩 orval
  //     faker handler（*/api 通配任意 origin）命中，DOM 测试拿到假数据）
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5173",
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE || "msw-http",
} as const;
