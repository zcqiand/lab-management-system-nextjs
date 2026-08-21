# lab-management-system-nextjs 生产镜像
# 与姊妹仓 saas-identity-platform 的差异:那边是静态 SPA 用 nginx:alpine 托管;
# 这边是 Next.js SSR + better-sqlite3,必须用 Node 运行时,容器内监听 3000。
#
# 单阶段:运行时要跑 drizzle-kit migrate(devDep)与 tsx seed(devDep),
# 精简成 standalone 会丢掉它们 —— 镜像偏大是已知取舍,留作后续优化。
# node 24:npm 10.8(node 20)对本仓 lock 的嵌套 esbuild optional 结构误判 Missing,
# npm 11(node 24)正常;与 CI 及本地开发环境保持一致。
FROM node:24-slim
WORKDIR /app

# 硬约束:npm 依赖一律走 npmmirror。
RUN npm config set registry https://registry.npmmirror.com

# better-sqlite3@11 无 Node 24 预编译二进制(prebuild-install: No prebuilt binaries
# found target=24.x),会回退 node-gyp 源码编译 —— 需要 python3/make/g++
# + git 装 sibling 仓 (file: 依赖 + gen:shared)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 拉 sibling 仓（file: 依赖 + gen:shared 需要 sibling 存在）
RUN git clone --depth 1 https://github.com/zcqiand/lab-management-system-msw.git ../lab-management-system-msw \
 && git clone --depth 1 https://github.com/zcqiand/lab-management-system-shared.git ../lab-management-system-shared

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# build 阶段用内存库:next build 收集页面数据时会 import src/db/index.ts(顶层开库),
# 镜像里没有 data/ 目录,指向文件路径会 SQLITE_CANTOPEN
RUN DB_PATH=:memory: npm run build

# /data 是卷挂载点(docker run -v .../data:/data);先建好,裸跑不挂卷也不至于炸
RUN mkdir -p /data

# DB_PATH 指向卷挂载点
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/lab.db
EXPOSE 3000

# slim 没有 wget/curl,用 node fetch 探活
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["sh", "deploy/docker-entrypoint.sh"]
