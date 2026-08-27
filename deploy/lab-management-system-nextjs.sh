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
#   - 容器内是 Node(next start :3000),不是 nginx:80 → -p 127.0.0.1:8012:3000
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
  echo "→ generate $BASE/lab.env (DATABASE_URL + LAB_JWT_SECRET + SAAS_IDP_URL + SAAS_UI_BASE_URL + NEXT_PUBLIC_APP_ID)"
  umask 077
  {
    printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
    printf 'LAB_JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    # Phase 4 env 对称化: SAAS_BASE_URL 拆成 SAAS_IDP_URL (IdP 端点) + SAAS_UI_BASE_URL (登录 UI 页)
    printf 'SAAS_IDP_URL=%s\n' "${SAAS_IDP_URL:-https://saas-nextjs.xiangru.uk}"
    printf 'SAAS_UI_BASE_URL=%s\n' "${SAAS_UI_BASE_URL:-https://saas-nextjs.xiangru.uk}"
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "${NEXT_PUBLIC_SAAS_BASE_URL:-https://saas-nextjs.xiangru.uk}"
    printf 'NEXT_PUBLIC_APP_ID=%s\n' "${NEXT_PUBLIC_APP_ID:-lab-management}"
    # MSW 已删 (ADR-0012); 空串 = 同源走 lab-nextjs 自己的 /api/* Route Handler (连真 PG)
    printf 'NEXT_PUBLIC_API_BASE_URL=\n'
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
    printf 'SAAS_IDP_URL=%s\n' "${SAAS_IDP_URL:-https://saas-nextjs.xiangru.uk}"
    printf 'SAAS_UI_BASE_URL=%s\n' "${SAAS_UI_BASE_URL:-https://saas-nextjs.xiangru.uk}"
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "${NEXT_PUBLIC_SAAS_BASE_URL:-https://saas-nextjs.xiangru.uk}"
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

# nginx vhost 自举（缺时创建,不 reload —— reload 要 root）:
# 检测 /etc/nginx/sites-enabled/<NGINX_DOMAIN> 是否存在;缺时从 nginx-vps.conf.example
# 模板渲染,做 symlink。reload 需 sudo,留给手工:
#   sudo nginx -t && sudo systemctl reload nginx
NGINX_DOMAIN="${NGINX_DOMAIN:-lab-nextjs.xiangru.uk}"
NGINX_CERT_BASENAME="${NGINX_CERT_BASENAME:-xiangru-uk}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_VHOST_FILE="${NGINX_SITES_AVAILABLE}/${NGINX_DOMAIN}"
NGINX_VHOST_LINK="${NGINX_SITES_ENABLED}/${NGINX_DOMAIN}"
NGINX_TEMPLATE="${BASE}/nginx-vps.conf.example"

echo "→ nginx bootstrap: NGINX_DOMAIN='${NGINX_DOMAIN}' CERT='${NGINX_CERT_BASENAME}'"
echo "→ nginx vhost target: ${NGINX_VHOST_FILE} (symlink ${NGINX_VHOST_LINK})"
echo "→ nginx template: ${NGINX_TEMPLATE}"

# 拉模板（deploy/ 目录随仓库 deploy 脚本一起,但首次拉时可能不存在,补一下）
if [ ! -f "${NGINX_TEMPLATE}" ]; then
  echo "→ fetching nginx-vps.conf.example template from raw.githubusercontent.com"
  if ! curl -fsSL "https://raw.githubusercontent.com/zcqiand/lab-management-system-nextjs/refs/heads/master/deploy/nginx-vps.conf.example" -o "${NGINX_TEMPLATE}"; then
    echo "ERROR: failed to fetch nginx template, vhost bootstrap aborts"
  else
    echo "→ template fetched ($(wc -l < "${NGINX_TEMPLATE}") lines)"
  fi
else
  echo "→ template already cached at ${NGINX_TEMPLATE}"
fi

if [ ! -f "${NGINX_TEMPLATE}" ]; then
  echo "ERROR: nginx template missing, skipping vhost bootstrap (do 'cp deploy/nginx-vps.conf.example ${BASE}/' manually)"
elif [ -e "${NGINX_VHOST_LINK}" ] || [ -e "${NGINX_VHOST_FILE}" ]; then
  echo "→ nginx vhost ${NGINX_VHOST_FILE} already exists, skip bootstrap"
else
  echo "→ nginx vhost missing, bootstrapping"
  umask 022
  if sed \
    -e "s/lab\.YOUR_DOMAIN/${NGINX_DOMAIN}/g" \
    -e "s|/etc/nginx/ssl/your-cert.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
    -e "s|/etc/nginx/ssl/your-cert.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
    "${NGINX_TEMPLATE}" > "${NGINX_VHOST_FILE}"; then
    if ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}"; then
      echo "→ nginx vhost created at ${NGINX_VHOST_FILE}"
      echo "→ symlink created at ${NGINX_VHOST_LINK}"
      echo "→ next: sudo nginx -t && sudo systemctl reload nginx"
    else
      echo "ERROR: failed to create symlink ${NGINX_VHOST_LINK}"
    fi
  else
    echo "ERROR: sed failed, vhost not created"
  fi
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
  -p "127.0.0.1:8012:3000" \
  -v "$BASE/data:/data" \
  --env-file "$BASE/lab.env" \
  "$IMAGE"

echo "→ docker image prune"
docker image prune -f

echo "→ docker ps"
docker ps --filter name=lab-management-system-nextjs

echo "→ deploy done at $(date -u)"
