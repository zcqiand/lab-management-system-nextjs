import type { NextConfig } from "next";

/**
 * infra-only next.config。本仓**只用** `pg` 一个驱动（被 sync-db.mjs / emit-schema.mjs /
 * borrow-pg.mjs / db.smoke.test.ts / src/db/index.ts 共享）。
 *
 * `pg` 是 native binding，不能被打进 server bundle 的普通产物——Next 默认 external，
 * 这里显式声明是为升级 next 时第一时间被 regressed 注意到。
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
