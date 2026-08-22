# =============================================================================
# lab-management-system-nextjs — 生产镜像
#
#   builder  → 装 deps + gen:shared(orval → src/api/endpoints/) + next build
#   runtime  → node:24-slim + standalone server, 监听 PORT=3000
#
# 数据库:PostgreSQL(远程)。容器内不持有 DB 文件 —— 运行期必须通过 DATABASE_URL
#         环境变量注入连接串(由 VPS saas.env 注入)。
#         `pg` 是 native binding, 不能打入 server bundle 普通产物 —— Next 默认
#         external + serverExternalPackages: ["pg"] 显式声明。
#
# generated/schema.ts:CI deploy job 在 docker build 之前对 postgres service 跑
#                   sync-db + drizzle-kit pull,产物落 generated/schema.ts。
#                   本 Dockerfile 直接 COPY . . 就能拿到。
#
# 迁移 / seed:runtime entrypoint 跑 scripts/sync-db.mjs + scripts/seed-db.mjs
#         (seed 仅首启执行,靠 __schema_migrations 是否为空判断)。
#
# 端口:容器内 next start 监听 :3000;VPS nginx 反代到 publish 出的端口(默认 8022)。
#
# 节点用户:slim 镜像只有 root;我们用 `node` 用户跑 next。
# =============================================================================


# ---------- Stage 1: builder ----------
FROM node:24-slim AS builder
WORKDIR /app

# 硬约束:npm 依赖一律走 npmmirror(CLAUDE.md §2)。
RUN npm config set registry https://registry.npmmirror.com

# node:24-slim 默认无 git / ca-certificates,装上以 clone sibling 仓
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 拉 sibling 仓(file: 依赖 + gen:shared 需要 sibling 存在)
# msw: package.json 的 @lab/management-system-msw@file:../lab-management-system-msw
# shared: npm run gen:shared emit-openapi 读 ../lab-management-system-shared
RUN git clone --depth 1 https://github.com/zcqiand/lab-management-system-msw.git ../lab-management-system-msw \
 && git clone --depth 1 https://github.com/zcqiand/lab-management-system-shared.git ../lab-management-system-shared

COPY package.json package-lock.json ./
# 用 npm install 不是 npm ci:package.json 引用 file:../lab-management-system-msw
# (file path 版本,无具体版本号),旧 lockfile 锁了 0.1.0 → npm ci 严格不匹配。
# npm install 按 package.json + sibling 实际版本安装,自动重写 lockfile。
# --legacy-peer-deps 兼容某些宽松 peer 依赖。
# --install-links: file: 依赖打包复制进 node_modules 而不是 symlink 回 sibling clone。
#   symlink 时 TS/webpack 解析到 clone 真实路径(/lab-management-system-msw/src),
#   clone 没装依赖,import "msw" 往上找不到 → build 阶段 module not found。
#   复制后 msw/faker 等依赖提升到 /app/node_modules,解析恢复。
RUN npm install --install-links --legacy-peer-deps --no-audit --no-fund

# standalone build 不连 DB(除非某 route 顶层 open DB):gen:shared 只读
# yaml 不连 DB;sync-db / seed-db / drizzle-pull 留到 CI deploy job 跑。
COPY . .
# next build 的 "Collecting page data" 会 import 路由 handler → 触发 src/db/index.ts
# 模块加载(顶层 throw if !DATABASE_URL)。给个占位 URL 让 build 过,runtime 真正
# DATABASE_URL 由 deploy 阶段 saas.env 注入(ADR-0009)。
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ---------- Stage 2: runtime ----------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone/server.js 是 Next 生成的入口
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# public/ 不存在也 COPY (Next.js build 不报错,运行时 fallback 到 /404)
COPY --from=builder --chown=node:node /app/public ./public

# standalone 默认只 trace app/ pages/ src/ 入口路径下的 import 图,scripts/ 不在
# 范围 → .next/standalone/node_modules/ 是最小集,scripts/sync-db.mjs runtime
# require('pg') 找不到。pg 是 devDep(CLAUDE.md §3 硬约束不能升 dependencies),
# transitives(pg-types → postgres-array/date/bytea/interval, pgpass, pg-int8 等)
# 数量多且版本相关,逐个 COPY 易漏。
# 用 builder 全量 node_modules 覆盖 standalone minimal set —— runtime 镜像略大,
# 但 sync-db.mjs 必能命中所有 transitives。
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# sync-db.mjs 路径硬编码 ../lab-management-system-shared/sql/migrations
# (相对 /app),sibling 仓 git clone 在 builder /app 父目录,运行时容器里没有。
# 显式 COPY 到容器同绝对路径,sync-db.mjs 不用改。
COPY --from=builder --chown=node:node /saas-identity-platform-shared/sql/migrations /saas-identity-platform-shared/sql/migrations

# scripts/ 与 package.json(runtime sync-db / seed-db / drizzle 借链用)
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/package.json ./package.json

# data/ 占位(docker run -v 挂载点;裸跑不挂卷也不至于炸)
RUN mkdir -p /data && chown -R node:node /data

# entrypoint
COPY --chown=root:root deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# slim 没有 wget/curl,用 node fetch 探活
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
