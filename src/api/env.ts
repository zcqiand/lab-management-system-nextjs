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
// ADR-0019：NEXT_PUBLIC_API_BASE_URL 缺失 throw,不允许 fallback 到 localhost。
// dev 期用 docker compose 注入或 .env.local;prod 由 deploy 脚本生成。
//
// 空串 "" 视为「显式设空」——测试同源相对 URL 模式(msw/node setupServer
// 的相对路径 handler 匹配)依赖此语义。L0.no_fallback 锁的是「未设 = 字面」兜底,
// 不锁「显式空串」。
//
// 关键：必须以字面量 `process.env.NEXT_PUBLIC_API_BASE_URL` 形式访问,
// 不能经 helper 函数中转。Next.js 用 webpack DefinePlugin 在 build 期把
// `process.env.NEXT_PUBLIC_FOO` 静态替换为字面值;中转后 key 是运行时字符串,
// DefinePlugin 无法识别,client bundle 拿到 undefined,浏览器侧 throw。
// (v0.3.73 修:Dockerfile + .env 补齐了 build-time 值,但 requireEnv 走 s.env[name]
// 动态访问,bundle 里仍是 process.env[name],prod 浏览器还是炸)
const NEXT_PUBLIC_API_BASE_URL_RAW = process.env.NEXT_PUBLIC_API_BASE_URL;
if (NEXT_PUBLIC_API_BASE_URL_RAW === undefined) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL env is required (ADR-0019 禁字面默认值). " +
      "Set via .env.local (dev) or Dockerfile ENV (prod).",
  );
}

export const env = {
  IDENTITY_BASE_URL: process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api",
  APP_ID: process.env.NEXT_PUBLIC_APP_ID || "lab-management",
  SSO_AUTHORIZE_URL: process.env.NEXT_PUBLIC_SSO_AUTHORIZE_URL || "/sso/authorize",
  OAUTH_SCOPES: process.env.NEXT_PUBLIC_OAUTH_SCOPES || "",
  NEXT_PUBLIC_API_BASE_URL: NEXT_PUBLIC_API_BASE_URL_RAW,
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE || "msw-http",
} as const;
