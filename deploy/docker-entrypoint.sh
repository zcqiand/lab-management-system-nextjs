#!/bin/sh
# 容器入口:迁移 →(仅首次)seed → next start
#
# - scripts/sync-db.mjs 幂等,跑 shared/sql/migrations/V*.sql 增量 apply,
#   写到 __schema_migrations tracking 表。可重跑,不会重复执行。
# - scripts/seed-db.mjs 默认 TRUNCATE 后灌,会**重置**种子数据。
#   仅在 __schema_migrations 还没有行(全新库)时执行,避免每次重启覆盖生产改动。
# - DB 用 PostgreSQL(远程),DATABASE_URL 由 `--env-file lab.env` 注入,
#   缺则 fail fast —— 不要回退到 dev 默认 URL,prod 不允许。
# - standalone:next start 跑 server.js(已 COPY 进来)。

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (VPS lab.env)" >&2
  exit 1
fi

# 探测是否首启:__schema_migrations 表是否空。空 → FIRST=1;非空 → 跳过 seed
FIRST=0
ROW_COUNT=$(node -e "
  import('pg').then(({Client}) => {
    const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
    c.connect().then(() => c.query(\"SELECT COUNT(*)::int AS n FROM pg_tables WHERE tablename = 'public.__schema_migrations'\"))
      .then(r => {
        if (r.rows[0].n === 0) { console.log('0'); process.exit(0); }
        return c.query('SELECT COUNT(*)::int AS n FROM public.__schema_migrations');
      })
      .then(r => { console.log(String(r.rows[0].n)); process.exit(0); })
      .catch(e => { console.error('probe failed:', e.message); process.exit(1); })
      .finally(() => c.end());
  });
" 2>/dev/null || echo "0")

if [ "${ROW_COUNT}" = "0" ]; then
  FIRST=1
fi

echo "→ sync-db (apply Flyway V*.sql from shared/, tracking __schema_migrations)"
node scripts/sync-db.mjs

if [ "$FIRST" = 1 ]; then
  echo "→ first run: seeding demo data from MSW seeds/*.json"
  # scripts/seed-db.ts 是 TypeScript,需要 tsx 跑(已在 devDependencies,全量
  # node_modules COPY 进来)
  npx tsx scripts/seed-db.ts
else
  echo "→ not first run, skipping seed (rows in __schema_migrations: ${ROW_COUNT})"
fi

echo "→ next start -p ${PORT:-3000}"
exec node server.js -p "${PORT:-3000}"
