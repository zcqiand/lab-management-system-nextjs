/**
 * vitest 全局 setup：infra-only 仓无需对 sqlite 跑迁移。
 * 真正的 PG smoke 由 tests/db.smoke.test.ts 在 .beforeAll 里借 pg + 跑 V*.sql 完成。
 * 本文件存在仅因为 profiles/nextjs.toml 的 scaffold 习惯于此文件名。
 *
 * DATABASE_URL 引导（setupFiles 先于测试模块 import 执行，@/db 顶层连接靠它）：
 * vitest 不读 .env*，而 .env.local 的 DATABASE_URL 是开发者本机占位
 * （localhost:5432，本机无 PG 时不可达）——不读它。解析顺序：
 * 进程 env（已设则不动）→ seed-db.ts / db.smoke.test.ts 同款 fallback（远程 lab_dev）。
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_dev";
}

