import type { NextConfig } from "next";

/**
 * infra-only next.config。本仓**只用** `pg` 一个驱动（被 sync-db.mjs / emit-schema.mjs /
 * borrow-pg.mjs / db.smoke.test.ts / src/db/index.ts 共享）。
 *
 * `pg` 是 native binding，不能被打进 server bundle 的普通产物——Next 默认 external，
 * 这里显式声明是为升级 next 时第一时间被 regressed 注意到。
 *
 * `transpilePackages: ["@lab/management-system-msw"]` — msw 是 file: 依赖,
 * 仓内 .ts 文件不上 next 默认 transpile → webpack 'Unexpected token' at import type。
 * 强制走 swc-loader 编 msw 的 .ts 文件(与 saas-nextjs 同模式)。
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  transpilePackages: ["@lab/management-system-msw"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
