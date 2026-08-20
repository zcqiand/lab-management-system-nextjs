#!/bin/sh
# 容器入口:迁移 →(仅首次)seed → next start
#
# - drizzle-kit migrate 幂等,由 drizzle/meta/_journal.json 驱动,升级版本时只补增量
# - seed 仅在 DB 文件不存在(首次挂空卷启动)时执行,避免每次重启覆盖生产改动
#   (seed 本身幂等 onConflictDoUpdate,但会把 seed 行重置回演示值)
set -eu

DB="${DB_PATH:-/data/lab.db}"

FIRST=0
[ -f "$DB" ] || FIRST=1

echo "→ drizzle-kit migrate (DB_PATH=$DB)"
npx --no drizzle-kit migrate

if [ "$FIRST" = 1 ]; then
  echo "→ first run: seeding demo data"
  npm run db:seed
fi

echo "→ next start -p ${PORT:-3000}"
exec npx --no next start -p "${PORT:-3000}"
