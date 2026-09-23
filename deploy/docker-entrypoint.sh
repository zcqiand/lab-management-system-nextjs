#!/bin/sh
# 容器入口:迁移 →(仅首次)seed → next start
#
# - scripts/migrate-db.mjs 幂等,调 drizzle-kit migrate 从 shared/drizzle/ 应用
#   迁移到 PG(Drizzle Kit 内置 __drizzle_migrations 表 tracking)。可重跑,不会
#   重复执行(ADR-0025 / ADR-0033 阶段一,commit 4587566 2026-09-13)。
# - scripts/seed-db.mjs 默认 TRUNCATE 后灌,会**重置**种子数据。
#   仅在 __drizzle_migrations 还没有行(全新库)时执行,避免每次重启覆盖生产改动。
# - DB 用 PostgreSQL(远程),DATABASE_URL 由 `--env-file lab.env` 注入,
#   缺则 fail fast —— 不要回退到 dev 默认 URL,prod 不允许。
# - standalone:next start 跑 server.js(已 COPY 进来)。

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (VPS lab.env)" >&2
  exit 1
fi

# drizzle-kit config 强制读 PG_* 五件套（即便 DATABASE_URL 已设 —— 它不解析 URL）
# 镜像 saas / lab 各仓 CI .github/workflows/ci.yml 同步显式注入 PG_HOST/PG_PORT/...
# 家族策略（memory springboot-gate-scaffold-needs-pg-url）= 派生层始终把单源 DATABASE_URL
# 裂成 PG_* 给下游 drizzle-kit。用 node URL 解析(自动 URL-decode user/password),
# shell 朴素切分会被 %40 / @ / : 字符破。已显式注入的 PG_* 保留(CI/dev 不覆盖)。
eval "$(node -e '
const u = new URL(process.env.DATABASE_URL);
if (!["postgresql:", "postgres:"].includes(u.protocol)) {
  console.error("ERROR: unsupported DATABASE_URL scheme:", u.protocol);
  process.exit(1);
}
const set = (k, v) => { if (!process.env[k]) process.stdout.write(`${k}=${JSON.stringify(v)}\nexport ${k}\n`); };
set("PG_HOST", u.hostname);
set("PG_PORT", u.port || "5432");
set("PG_USER", decodeURIComponent(u.username));
set("PG_PASSWORD", decodeURIComponent(u.password));
set("PG_DATABASE", u.pathname.replace(/^\//, ""));
')" || { echo "ERROR: DATABASE_URL parse failed (must be postgresql://user:pass@host:port/db)" >&2; exit 1; }

# 探测是否首启:__drizzle_migrations 表是否空。空 → FIRST=1;非空 → 跳过 seed。
# drizzle-kit 用 __drizzle_migrations(非老 sync-db.mjs 时代的 __schema_migrations)。
FIRST=0
ROW_COUNT=$(node -e "
  import('pg').then(({Client}) => {
    const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
    c.connect().then(() => c.query(\"SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = '__drizzle_migrations'\"))
      .then(r => {
        if (r.rows[0].n === 0) { console.log('0'); process.exit(0); }
        return c.query('SELECT COUNT(*)::int AS n FROM public.__drizzle_migrations');
      })
      .then(r => { console.log(String(r.rows[0].n)); process.exit(0); })
      .catch(e => { console.error('probe failed:', e.message); process.exit(1); })
      .finally(() => c.end());
  });
" 2>/dev/null || echo "0")

if [ "${ROW_COUNT}" = "0" ]; then
  FIRST=1
fi

echo "→ migrate-db (drizzle-kit migrate apply shared/drizzle/, tracking __drizzle_migrations)"
# 在 /lab-management-system-shared/ 跑 migrate-db.mjs：脚本本身算 SHARED_ROOT =
# __dirname/..,drizzle.config.ts + drizzle/ 都在 sibling 仓根目录。
cd /lab-management-system-shared
node scripts/migrate-db.mjs
cd /app

if [ "$FIRST" = 1 ]; then
  echo "→ first run: seeding demo data from shared seeds/*.json"
  # scripts/seed-db.ts 是 TypeScript,需要 tsx 跑(已在 devDependencies,全量
  # node_modules COPY 进来)
  npx tsx scripts/seed-db.ts
else
  echo "→ not first run, skipping seed (rows in __drizzle_migrations: ${ROW_COUNT})"
fi

echo "→ next start -p ${PORT:-5201}"
exec node server.js -p "${PORT:-5201}"
