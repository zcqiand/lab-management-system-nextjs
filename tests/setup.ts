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
// 家族统一：默认连共享 lab_test（gate 跑真库）。lab_dev 只在显式 DATABASE_URL 时用。
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/lab_test";
}

// API base URL 引导（同 lab-react .env.test 语义）：vitest 不读 .env*，
// 未显式设置时置空串 -> 相对 URL，jsdom origin 与 msw/node setupServer 的
// 相对路径 handler（handlers-extra）同源匹配。若走 || 回退 :5200 绝对 URL，
// 只有 orval faker handler（*/api 通配）能命中，DOM 测试全拿假数据。
if (process.env.NEXT_PUBLIC_API_BASE_URL === undefined) {
  process.env.NEXT_PUBLIC_API_BASE_URL = "";
}

// ADR-0019：以下 env 在 src/ 顶层 requireEnv,测试模块 import 时就 throw。
// 显式 seed dev 值,等同 .env.test 同步覆盖。dev/prod 真值由 deploy 脚本注入。
const ADR0019_TEST_ENV: Record<string, string> = {
  SAAS_IDP_URL: "http://localhost:5101",
  SAAS_UI_BASE_URL: "http://localhost:5101",
  SAAS_OAUTH_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
  SAAS_OAUTH_CLIENT_SECRET: "lab-mgmt-secret",
  SAAS_OAUTH_SCOPE: "lab.read lab.write",
  SAAS_TENANT_ID: "00000000-0000-0000-0000-000000000001",
  LAB_SAAS_SERVICE_USER: "alice",
  LAB_SAAS_SERVICE_PASSWORD: "dev123456",
  LAB_AUTH_DEV_PASSWORD: "dev123456",
  NEXT_PUBLIC_SAAS_BASE_URL: "http://localhost:5101",
  NEXT_PUBLIC_LAB_APP_CODE: "lab-management",
  NEXT_PUBLIC_SAAS_OAUTH_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
};
for (const [k, v] of Object.entries(ADR0019_TEST_ENV)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

