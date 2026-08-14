import type { NextConfig } from "next";

/**
 * infra-only next.config：本仓不渲染产品页面、serverExternalPackages 主要声明 `pg`
 * 是 native binding（被 emit-schema.mjs / borrow-pg.mjs 用），不能被打包进 server bundle。
 *
 * `better-sqlite3` 仍存在但 L4 smoke 仅在 vitest 跑（不进 next build），故不列入。
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
