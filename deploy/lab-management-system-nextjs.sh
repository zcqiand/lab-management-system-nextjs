#!/bin/sh
# Usage: lab-management-system-nextjs.sh <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]
#
# 由 .github/workflows/ci.yml 的 deploy job 远程调用:
#   ssh deploy@vps -- cd /home/deploy/lab-management-system-nextjs
#                    && sh lab-management-system-nextjs.sh $DOCKER_USERNAME $DOCKER_PASSWORD $VERSION
#
# VERSION 默认是 latest。tag-based deploy 时显式传 tag 名(v1.1-001)。
# CI 同时 push :latest + :<tag> 两份镜像,回滚只要手动指定旧 tag 再跑一次本脚本。
#
# 与姊妹仓 saas-identity-platform.sh 的差异:
#   - 容器内 Node(next start :5201);host=container=5201（ADR-0018 单层 port 方案,
#     docker run -p 127.0.0.1:5201:5201；lab 家族 X01 段）
#   - SQLite 挂卷持久化:./data ↔ /data(容器 entrypoint 首启迁移 + seed)
#   - 密钥走 ./lab.env(LAB_JWT_SECRET),由 setup-vps.sh 生成,只存在于 VPS
#
# 前置:deploy 用户需在 docker 组中(sudo usermod -aG docker deploy)。

set -eu

USERNAME="${1:-}"
PASSWORD="${2:-}"
VERSION="${3:-latest}"
IMAGE="${USERNAME}/lab-management-system-nextjs:${VERSION}"
BASE="/home/deploy/lab-management-system-nextjs"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]" >&2
  exit 2
fi

# lab.env 自举:缺失时就地生成随机 LAB_JWT_SECRET(只在 VPS 本地生成,
# 不进 CI 日志/仓库)。重新生成会失效所有登录态,故仅在文件不存在时执行;
# setup-vps.sh 若已生成过则这里跳过。
# v0.3.55:AUTH_JWT_SECRET 是死键(src/lib/auth/factory.ts 读的是 LAB_JWT_SECRET,
# 老 key 从未被读过,prod 一直用 factory.ts 硬编码 dev fallback 签发),改名对齐。
# v0.3.0.1:同时写入 SAAS_BASE_URL(server)与 NEXT_PUBLIC_SAAS_BASE_URL(client)。
# v0.3.34:加 DATABASE_URL(src/db/index.ts 用 postgres-js,容器启动必填)。
# v0.3.35:NEXT_PUBLIC_APP_ID 对齐 src/api/env.ts:11 真正读的 key(原本写错名
# NEXT_PUBLIC_SAAS_APP_ID 是死配置);SAAS_OAUTH_CLIENT_ID 在 src/ 0 引用,
# 删(等 M03.F02 OIDC 真落地时再补)。
# 必须从 \$DATABASE_URL env 或 ssh-action envs 传入,不允许凭空写默认值
# —— 默认 URL 会触发对 saas_dev 等生产容器写入,跨域事故。
# 缺则 fail fast,提示用户用 GitHub Secret 配 \$DATABASE_URL。
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL env is required to bootstrap lab.env (set in GitHub Actions secret DATABASE_URL)" >&2
  exit 1
fi
if [ ! -f "$BASE/lab.env" ]; then
  # 禁默认值兜底(2026-08-28 CLAUDE.md 硬规则):secret 类必须显式传入并 fail-fast
  # 指明缺哪个 —— 服务账号缺失时 login/route.ts 会静默吃 dev fallback alice/dev123456,
  # 菜单快照打错账号还无声。
  if [ -z "${LAB_SAAS_SERVICE_USER:-}" ] || [ -z "${LAB_SAAS_SERVICE_PASSWORD:-}" ]; then
    echo "ERROR: LAB_SAAS_SERVICE_USER/PASSWORD env required to bootstrap lab.env (add GitHub Secrets LAB_SAAS_SERVICE_USER/LAB_SAAS_SERVICE_PASSWORD → ci.yml envs → ssh-action envs)" >&2
    exit 1
  fi
  echo "→ generate $BASE/lab.env (key 集合与仓内 .env.production 严格对齐,suite L0.5 check_deploy_parity 锁死)"
  umask 077
  {
    printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
    printf 'LAB_JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    # Phase 4 env 对称化: SAAS_BASE_URL 拆成 SAAS_IDP_URL (IdP 端点) + SAAS_UI_BASE_URL (登录 UI 页)。
    # 非 secret 走显式 prod 字面量(值 = .env.production 契约值),不吃 ${VAR:-default} 兜底。
    printf 'SAAS_IDP_URL=https://saas-nextjs.xiangru.uk\n'
    printf 'SAAS_UI_BASE_URL=https://saas-nextjs.xiangru.uk\n'
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=https://saas-nextjs.xiangru.uk\n'
    # v0.3.56: NEXT_PUBLIC_APP_ID 是死键(src/api/env.ts 零引用),真名是 sidebar-nav/app-shell
    # 读的 NEXT_PUBLIC_LAB_APP_CODE。NEXT_PUBLIC_* 是 build-time 烘焙,这行只影响
    # server 侧 process.env,写上保 key 集合对齐。
    printf 'NEXT_PUBLIC_LAB_APP_CODE=lab-management\n'
    # MSW 已删 (ADR-0012); 空串 = 同源走 lab-nextjs 自己的 /api/* Route Handler (连真 PG)
    printf 'NEXT_PUBLIC_API_BASE_URL=\n'
    printf 'NEXT_PUBLIC_API_MODE=nextjs\n'
    # v0.3.56 key 对齐(2026-08-28 线上漂移修复):显式字面量 = .env.production 契约值
    printf 'LAB_SAAS_SERVICE_USER=%s\n' "$LAB_SAAS_SERVICE_USER"
    printf 'LAB_SAAS_SERVICE_PASSWORD=%s\n' "$LAB_SAAS_SERVICE_PASSWORD"
    printf 'LAB_JWT_ISSUER=lab-management-system\n'
    printf 'LAB_JWT_TTL_SECONDS=3600\n'
    printf 'LAB_JWT_REFRESH_TTL_SECONDS=604800\n'
    printf 'LAB_SSO_PROFILE=real\n'
    printf 'SAAS_OAUTH_CLIENT_ID=11111111-1111-1111-1111-111111111111\n'
  } > "$BASE/lab.env"
fi
# 兼容旧 lab.env:已存在但缺 DATABASE_URL,追加(不覆盖 LAB_JWT_SECRET)
if [ -f "$BASE/lab.env" ] && ! grep -q '^DATABASE_URL=' "$BASE/lab.env"; then
  echo "→ append DATABASE_URL to existing $BASE/lab.env"
  umask 077
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL" >> "$BASE/lab.env"
fi
# v0.3.55 迁移:老 lab.env 的死键 AUTH_JWT_SECRET → LAB_JWT_SECRET(factory.ts 真名)。
# 沿用旧值(已是随机 32B),不重新生成,避免无谓失效;没有 AUTH_JWT_SECRET 也没有
# LAB_JWT_SECRET 的老文件(密钥一直在吃代码 fallback)就地生成新随机值。
if [ -f "$BASE/lab.env" ]; then
  if grep -q '^AUTH_JWT_SECRET=' "$BASE/lab.env"; then
    echo "→ migrate AUTH_JWT_SECRET → LAB_JWT_SECRET in $BASE/lab.env"
    old_secret=$(grep '^AUTH_JWT_SECRET=' "$BASE/lab.env" | head -1 | cut -d= -f2-)
    umask 077
    sed -i '/^AUTH_JWT_SECRET=/d' "$BASE/lab.env"
    printf 'LAB_JWT_SECRET=%s\n' "$old_secret" >> "$BASE/lab.env"
  elif ! grep -q '^LAB_JWT_SECRET=' "$BASE/lab.env"; then
    echo "→ append LAB_JWT_SECRET (was missing; prod had been using code fallback)"
    umask 077
    printf 'LAB_JWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$BASE/lab.env"
  fi
fi
# v0.3.56 key 对齐迁移(2026-08-28 线上漂移修复):老 lab.env 停在 7 key,
# 仓内 .env.production 已到 16 key。逐 key append-if-missing(值 = fallback
# 同值默认,不改变运行行为;要覆盖走 ssh-action envs)。
# key 集合契约由 tests/deploy-env-parity.test.ts 锁死,新加 key 必须两处同步。
if [ -f "$BASE/lab.env" ]; then
  append_if_missing() {
    key="$1"; val="$2"
    if ! grep -q "^${key}=" "$BASE/lab.env"; then
      echo "→ append ${key} to existing $BASE/lab.env"
      umask 077
      printf '%s=%s\n' "$key" "$val" >> "$BASE/lab.env"
    fi
  }
  append_if_missing NEXT_PUBLIC_LAB_APP_CODE 'lab-management'
  append_if_missing NEXT_PUBLIC_API_MODE 'nextjs'
  # 服务账号是 secret 类:老文件已有则保留;没有则从 env 传入,fail-fast 不兜底
  if ! grep -q '^LAB_SAAS_SERVICE_USER=' "$BASE/lab.env"; then
    if [ -z "${LAB_SAAS_SERVICE_USER:-}" ] || [ -z "${LAB_SAAS_SERVICE_PASSWORD:-}" ]; then
      echo "ERROR: LAB_SAAS_SERVICE_USER/PASSWORD missing in $BASE/lab.env and not forwarded via ci.yml envs (login/route.ts fallback 是 dev 值 alice, prod 不得静默兜底)" >&2
      exit 1
    fi
    append_if_missing LAB_SAAS_SERVICE_USER "$LAB_SAAS_SERVICE_USER"
    append_if_missing LAB_SAAS_SERVICE_PASSWORD "$LAB_SAAS_SERVICE_PASSWORD"
  fi
  append_if_missing LAB_JWT_ISSUER 'lab-management-system'
  append_if_missing LAB_JWT_TTL_SECONDS '3600'
  append_if_missing LAB_JWT_REFRESH_TTL_SECONDS '604800'
  append_if_missing LAB_SSO_PROFILE 'real'
  append_if_missing SAAS_OAUTH_CLIENT_ID '11111111-1111-1111-1111-111111111111'
  # 死键清理:NEXT_PUBLIC_APP_ID 挂在零引用的 src/api/env.ts 上,真名
  # NEXT_PUBLIC_LAB_APP_CODE 已在上面 append,老 key 删除保 key 集合对齐。
  if grep -q '^NEXT_PUBLIC_APP_ID=' "$BASE/lab.env"; then
    echo "→ drop dead key NEXT_PUBLIC_APP_ID from $BASE/lab.env"
    umask 077
    sed -i '/^NEXT_PUBLIC_APP_ID=/d' "$BASE/lab.env"
  fi
fi
# 兼容旧 lab.env:已存在但缺 NEXT_PUBLIC_API_BASE_URL=,追加(同源)
if [ -f "$BASE/lab.env" ] && ! grep -q '^NEXT_PUBLIC_API_BASE_URL=' "$BASE/lab.env"; then
  echo "→ append NEXT_PUBLIC_API_BASE_URL= to existing $BASE/lab.env"
  umask 077
  printf 'NEXT_PUBLIC_API_BASE_URL=\n' >> "$BASE/lab.env"
fi
# 兼容旧 lab.env:已存在但缺 SAAS_IDP_URL / SAAS_UI_BASE_URL,追加(不覆盖 LAB_JWT_SECRET)
if [ -f "$BASE/lab.env" ] && ! grep -q '^SAAS_IDP_URL=' "$BASE/lab.env"; then
  echo "→ append SAAS_IDP_URL / SAAS_UI_BASE_URL to existing $BASE/lab.env"
  umask 077
  {
    printf 'SAAS_IDP_URL=https://saas-nextjs.xiangru.uk\n'
    printf 'SAAS_UI_BASE_URL=https://saas-nextjs.xiangru.uk\n'
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=https://saas-nextjs.xiangru.uk\n'
  } >> "$BASE/lab.env"
fi
# v0.3.44:迁移已知旧默认值。lab.env 已存在且 SAAS_BASE_URL 还是早期脚本的
# saas-react/react-id 旧默认 -> 原地替换为 saas-nextjs(SSO 供给方切换,
# /api/auth/sso/authorize 服务端用它拼登录页跳转)。自定义域名不受影响。
if [ -f "$BASE/lab.env" ] && grep -qE '^(SAAS_BASE_URL|NEXT_PUBLIC_SAAS_BASE_URL)=https://(saas-react|react-id)(\.xiangru\.uk|\.xiangru\.uk/api)$' "$BASE/lab.env"; then
  echo "-> migrate stale saas-react/react-id defaults to saas-nextjs in $BASE/lab.env"
  sed -i -E 's#^(SAAS_BASE_URL|NEXT_PUBLIC_SAAS_BASE_URL)=https://(saas-react|react-id)\.xiangru\.uk(/api)?$#\1=https://saas-nextjs.xiangru.uk#' "$BASE/lab.env"
fi
# Phase 4 env 对称化迁移: 旧 SAAS_BASE_URL → SAAS_IDP_URL + SAAS_UI_BASE_URL（同值）
# 老 lab.env 部署不会自动 rewrite (Phase 2A 已删 DevJwtDecoder, 现在 sso/authorize 502 是这个迁移缺失的连锁反应)
if [ -f "$BASE/lab.env" ] && grep -q '^SAAS_BASE_URL=' "$BASE/lab.env" && ! grep -q '^SAAS_IDP_URL=' "$BASE/lab.env"; then
  echo "→ migrate SAAS_BASE_URL → SAAS_IDP_URL + SAAS_UI_BASE_URL in $BASE/lab.env"
  existing_saas_base=$(grep '^SAAS_BASE_URL=' "$BASE/lab.env" | head -1 | cut -d= -f2-)
  umask 077
  # 删 SAAS_BASE_URL, 加 SAAS_IDP_URL + SAAS_UI_BASE_URL (同值)
  sed -i -E '/^SAAS_BASE_URL=/d' "$BASE/lab.env"
  printf 'SAAS_IDP_URL=%s\n' "$existing_saas_base" >> "$BASE/lab.env"
  printf 'SAAS_UI_BASE_URL=%s\n' "$existing_saas_base" >> "$BASE/lab.env"
fi
mkdir -p "$BASE/data"

# nginx vhost 重渲染（每次 deploy 都跑,ADR-0018:容器端口变了 vhost 必须跟）:
# 模板从 master 拉,渲染后写入 sites-available,symlink sites-enabled,再 sudo nginx -t + reload。
# diff 检测:内容未变跳过 reload (nginx -t 也省)。
NGINX_DOMAIN="${NGINX_DOMAIN:-lab-nextjs.xiangru.uk}"
NGINX_CERT_BASENAME="${NGINX_CERT_BASENAME:-xiangru-uk}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_VHOST_FILE="${NGINX_SITES_AVAILABLE}/${NGINX_DOMAIN}"
NGINX_VHOST_LINK="${NGINX_SITES_ENABLED}/${NGINX_DOMAIN}"
NGINX_TEMPLATE="${BASE}/nginx-vps.conf.example"

# 拉模板:每次都从 master 拉最新 —— VPS 本地会留 7 月老模板(801x 端口时代),
# fetch-if-missing 让它永不更新 → 渲染出 proxy_pass 8010 全家族 502
# (2026-09-03 事故根因之二)
echo "→ fetching nginx-vps.conf.example template (always fresh from master)"
if ! curl -fsSL "https://raw.githubusercontent.com/zcqiand/lab-management-system-nextjs/refs/heads/master/deploy/nginx-vps.conf.example" -o "${NGINX_TEMPLATE}"; then
  echo "ERROR: failed to fetch nginx template, vhost re-render aborts"
  exit 1
fi

# 渲染到临时文件 —— sed 同时覆盖 3 种 placeholder:
#   Style A (lab-vue/react):      <domain>
#   Style B/C (nextjs/sp/aspc):   lab.YOUR_DOMAIN / saas.YOUR_DOMAIN
#   cert 路径: your-cert.{crt,cert} / <domain>.crt → 统一到 ${NGINX_CERT_BASENAME}.cert
TMP_VHOST="$(mktemp -t vpstpl.XXXXXX)"
# cert 归一化规则必须排在 <domain>/YOUR_DOMAIN 通配之前:sed -e 按顺序执行,
# 先替换 <domain> 会把 cert 路径里的占位符一并吃掉,后面的 cert 规则全部失配
# (2026-09-03 VPS nginx -t "cannot load certificate <域名>.crt" 事故根因)
sed \
  -e "s|/etc/nginx/ssl/<domain>\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|/etc/nginx/ssl/your-cert\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|<domain>|${NGINX_DOMAIN}|g" \
  -e "s|lab\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  -e "s|saas\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  "${NGINX_TEMPLATE}" > "${TMP_VHOST}"

# diff 检测:已有 vhost 且内容相同就 skip,不同才重写 + reload
if [ -e "${NGINX_VHOST_FILE}" ] && diff -q "${TMP_VHOST}" "${NGINX_VHOST_FILE}" >/dev/null 2>&1; then
  echo "→ nginx vhost ${NGINX_VHOST_FILE} unchanged, skip"
  rm -f "${TMP_VHOST}"
else
  echo "→ rendering nginx vhost ${NGINX_VHOST_FILE} (domain=${NGINX_DOMAIN} cert=${NGINX_CERT_BASENAME})"
  # 写入 sites-available (deploy 用户可能没写权限,需要 sudoers 配 nginx 白名单)
  if [ -w "${NGINX_SITES_AVAILABLE}" ]; then
    cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}"
  else
    sudo cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}" \
      || { echo "ERROR: sudo cp ${NGINX_VHOST_FILE} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  # symlink sites-enabled
  if [ -w "${NGINX_SITES_ENABLED}" ]; then
    ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}"
  else
    sudo ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}" \
      || { echo "ERROR: sudo ln ${NGINX_VHOST_LINK} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  rm -f "${TMP_VHOST}"
  # nginx config test + reload (CI 自动完成,不再依赖手工)
  echo "→ nginx -t"
  sudo nginx -t
  echo "→ systemctl reload nginx"
  sudo systemctl reload nginx
  echo "✓ nginx reloaded"
fi

echo "→ image: $IMAGE"
echo "→ docker login"
printf '%s' "$PASSWORD" | docker login -u "$USERNAME" --password-stdin

echo "→ docker pull"
docker pull "$IMAGE"

echo "→ docker stop & rm lab-management-system-nextjs"
docker stop lab-management-system-nextjs 2>/dev/null || true
docker rm lab-management-system-nextjs 2>/dev/null || true

echo "→ docker run"
docker run -d \
  --name lab-management-system-nextjs \
  --restart unless-stopped \
  -p "127.0.0.1:5201:5201" \
  -v "$BASE/data:/data" \
  --env-file "$BASE/lab.env" \
  "$IMAGE"

echo "→ docker image prune"
docker image prune -f

echo "→ docker ps"
docker ps --filter name=lab-management-system-nextjs

echo "→ deploy done at $(date -u)"
