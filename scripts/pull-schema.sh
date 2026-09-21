#!/usr/bin/env bash
# scripts/pull-schema.sh — drizzle-kit pull 从真库反推 src/db/schema.ts（DB-First, ADR-0025/ADR-0033）
#
# 设计（镜像 saas-identity-platform-nextjs/scripts/pull-schema.sh）：
# - 共享 shared 仓是真源（schema-first）；shared 跑 migrate-db 应用到 DB
# - nextjs 跑 drizzle-kit pull 把 DB 结构反推为 src/db/schema.ts
# - drizzle-kit pull 默认输出到 drizzle/schema.ts（不在 src/db/）；本脚本 move + cleanup
# - lab 特有：TEXT DEFAULT '' 列 pull 后是 .default(') 空模板串——
#   move 后先跑 scripts/fix-pulled-schema.mjs 修复，再做 drift 检测
# - 生成的 schema.ts 入 git；drift（与 git HEAD 对比）= DB 真演进或本地未同步，exit 1
#
# 用法：
#   bash scripts/pull-schema.sh                       # pull from lab_dev
#   PG_DATABASE=lab_test bash scripts/pull-schema.sh
#
# 退出码：
#   0 — pulled OK + 与 git HEAD 一致
#   1 — pull 失败 或 与 git HEAD 有 diff（需手动 commit）

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SCHEMA_FILE="src/db/schema.ts"
PULL_OUT_DIR="drizzle"

echo "[pull-schema] step 1/5 — drizzle-kit pull → ${PULL_OUT_DIR}/schema.ts"
PG_HOST="${PG_HOST:-100.79.128.25}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"
PG_DATABASE="${PG_DATABASE:-lab_dev}"
export PG_HOST PG_PORT PG_USER PG_PASSWORD PG_DATABASE

if [ -z "$PG_PASSWORD" ]; then
  echo "[pull-schema] FATAL: PG_PASSWORD 未设" >&2
  exit 1
fi

# 清理上一次的 drizzle/ 产物（pull 会写到 drizzle/）
rm -rf "$PULL_OUT_DIR"

npx --no drizzle-kit pull --config drizzle.config.ts

if [ ! -f "${PULL_OUT_DIR}/schema.ts" ]; then
  echo "[pull-schema] FATAL: ${PULL_OUT_DIR}/schema.ts 未生成" >&2
  exit 1
fi

echo "[pull-schema] step 2/5 — move ${PULL_OUT_DIR}/schema.ts → ${SCHEMA_FILE}"
mkdir -p "$(dirname "$SCHEMA_FILE")"
mv "${PULL_OUT_DIR}/schema.ts" "${SCHEMA_FILE}"

echo "[pull-schema] step 3/5 — fix pulled schema（.default(') / 未用 sql import）"
node scripts/fix-pulled-schema.mjs

echo "[pull-schema] step 4/5 — cleanup ${PULL_OUT_DIR}/"
# relations.ts 是 drizzle-kit 自动生成的辅助文件；本仓不需要
rm -rf "$PULL_OUT_DIR"

echo "[pull-schema] step 5/5 — drift detection: git diff ${SCHEMA_FILE}"
if ! git diff --exit-code --quiet "${SCHEMA_FILE}" 2>/dev/null; then
  echo "[pull-schema] FATAL: ${SCHEMA_FILE} 与 git HEAD 不一致" >&2
  echo "[pull-schema]        漂移来源：" >&2
  git diff --stat "${SCHEMA_FILE}" >&2
  echo "[pull-schema]        处理：确认 DB 是最新（shared 已 migrate-db），然后 git add ${SCHEMA_FILE} && git commit" >&2
  exit 1
fi

echo "[pull-schema] OK"
echo "[pull-schema]    ${SCHEMA_FILE} 与 git HEAD 一致；DB-First sync 绿"

# ADR-0026 §2: 写 last-gen-shared.json marker（DB 类别），失败不阻塞 pull-schema。
SHARED_DIR="$(cd "$(git rev-parse --show-toplevel)/../lab-management-system-shared" && pwd)"
SHARED_SHA=$(cd "$SHARED_DIR" && git rev-parse HEAD)
MARKER="$(git rev-parse --show-toplevel)/.state/last-gen-shared.json"
mkdir -p "$(dirname "$MARKER")"

if python3 - "$MARKER" "$SHARED_SHA" "$(basename "$0")" "lab-management-system-nextjs" <<'PYEOF'
import datetime, json, sys

marker_path, shared_sha, cmd, repo = sys.argv[1:5]
try:
    with open(marker_path, encoding="utf-8") as f:
        marker = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    marker = {}

# 5.77（2026-09-21 人裁立项）：同 sha 零写入——目标通道 synced_sha 与现存 marker 相同
# → 整个 marker 文件零写入（时间戳/mtime 保持原值，字节级幂等）；sha 真变才全量写
# （新 sha + 新时间戳）。判据只比 sha，时间戳不参与；JSON 形状/key 名一概不动。
if cmd.startswith("gen-shared"):
    channel = "api_synced"
elif cmd.startswith(("scaffold", "sync-db", "pull-schema")):
    channel = "db_synced"
else:
    channel = None

if channel is not None and marker.get(channel + "_sha") == shared_sha:
    print("[marker] %s_sha unchanged (%s...) - zero write, keep timestamp (5.77)"
          % (channel, shared_sha[:12]))
    sys.exit(3)

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
if channel is not None:
    marker[channel + "_sha"] = shared_sha
    marker[channel + "_at"] = now
    marker[channel + "_cmd"] = cmd

# shared_sha 取「最近一次同步」对应的 sha：ISO-8601 UTC 时间戳字典序==时间序。
# 勿用 max(sha)——SHA 字典序不是 git 时间序（5.21 事故）。
entries = [
    (marker.get(k + "_at", ""), marker[k + "_sha"])
    for k in ("api_synced", "db_synced")
    if marker.get(k + "_sha")
]
marker["shared_sha"] = max(entries)[1] if entries else shared_sha
marker["consumer_repo"] = repo

with open(marker_path, "w", encoding="utf-8") as f:
    json.dump(marker, f, ensure_ascii=False, indent=2)
    f.write("\n")
PYEOF
then
  echo "[pull-schema]    ADR-0026 marker 已落盘: $MARKER (shared HEAD ${SHARED_SHA:0:7})"
else
  rc=$?
  if [ "$rc" -eq 3 ]; then
    echo "[pull-schema]    ADR-0026 marker sha 未变，零写入（5.77 同 sha 不刷时间戳）: $MARKER"
  else
    echo "[pull-schema]    WARN: marker 写失败（python3 缺失？）—— staleness 将报 UNKNOWN" >&2
  fi
fi
