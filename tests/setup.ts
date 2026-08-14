/**
 * vitest 全局 setup：infra-only 仓无需对 sqlite 跑迁移。
 * 真正的 PG smoke 由 tests/db.smoke.test.ts 在 .beforeAll 里借 pg + 跑 V*.sql 完成。
 * 本文件存在仅因为 profiles/nextjs.toml 的 scaffold 习惯于此文件名。
 */
export {};
