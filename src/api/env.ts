// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；ADR-0019 禁 localhost 兜底
//   NEXT_PUBLIC_API_MODE       显示标签；默认 "msw-http"
//
// ADR-0012 v0.3.0：删除 NEXT_PUBLIC_ENABLE_MSW（Service Worker 模式已删除）。
// ADR-0019：NEXT_PUBLIC_API_BASE_URL 缺失 throw，不允许 fallback 到 localhost。
//   dev 期用 docker compose 注入或 .env.local；prod 由 deploy 脚本生成。
//
// 空串 "" 视为「显式设空」——测试同源相对 URL 模式（msw/node setupServer
// 的相对路径 handler 匹配）依赖此语义。L0.no_fallback 锁的是「未设 = 字面」兜底，
// 不锁「显式空串」。
function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(
      `${name} env is required (ADR-0019 禁字面默认值). ` +
        `Set via .env.local (dev) or GitHub Secrets → ci.yml envs (prod).`,
    );
  }
  return v;
}

export const env = {
  IDENTITY_BASE_URL: process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api",
  APP_ID: process.env.NEXT_PUBLIC_APP_ID || "lab-management",
  SSO_AUTHORIZE_URL: process.env.NEXT_PUBLIC_SSO_AUTHORIZE_URL || "/sso/authorize",
  OAUTH_SCOPES: process.env.NEXT_PUBLIC_OAUTH_SCOPES || "",
  // ADR-0019：缺失 throw，dev 期 .env.local 显式声明 (例 NEXT_PUBLIC_API_BASE_URL=http://localhost:5200)
  // 测试模式 .env.test 设空串 = 同源相对 URL，走 msw 相对路径 handler
  NEXT_PUBLIC_API_BASE_URL: requireEnv("NEXT_PUBLIC_API_BASE_URL"),
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE || "msw-http",
} as const;
