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
#   - 密钥走 ./lab.env(AUTH_JWT_SECRET),由 setup-vps.sh 生成,只存在于 VPS
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

# lab.env 自举:缺失时就地生成随机 AUTH_JWT_SECRET(只在 VPS 本地生成,
# 不进 CI 日志/仓库)。重新生成会失效所有登录态,故仅在文件不存在时执行;
# setup-vps.sh 若已生成过则这里跳过。
# v0.3.0.1:同时写入 SAAS_BASE_URL(server)与 NEXT_PUBLIC_SAAS_BASE_URL(client)。
# 这两个值仅在 lab.env 不存在时初始化;已有 env 文件里若没这两行,容器会用
# Next.js 默认 'http://localhost:3000' → SSO 跳转回 404,务必在 setup 时写入。
if [ ! -f "$BASE/lab.env" ]; then
  echo "→ generate $BASE/lab.env (AUTH_JWT_SECRET + SAAS_BASE_URL + NEXT_PUBLIC_ENABLE_MSW=false)"
  umask 077
  {
    printf 'AUTH_JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'SAAS_BASE_URL=%s\n' "${SAAS_BASE_URL:-https://saas-react.xiangru.uk}"
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "${NEXT_PUBLIC_SAAS_BASE_URL:-https://saas-react.xiangru.uk}"
    printf 'SAAS_OAUTH_CLIENT_ID=%s\n' "${SAAS_OAUTH_CLIENT_ID:-lab-management}"
    printf 'NEXT_PUBLIC_SAAS_APP_ID=%s\n' "${NEXT_PUBLIC_SAAS_APP_ID:-app-lab}"
    # MSW 关闭 → 走真 backend (lab-nextjs 自己的 /api/* Route Handler, 连真 PG)
    printf 'NEXT_PUBLIC_ENABLE_MSW=false\n'
    printf 'NEXT_PUBLIC_API_BASE_URL=\n'
  } > "$BASE/lab.env"
fi
# 兼容旧 lab.env:已存在但缺 NEXT_PUBLIC_ENABLE_MSW=false,追加(MSW 必须关)
if [ -f "$BASE/lab.env" ] && ! grep -q '^NEXT_PUBLIC_ENABLE_MSW=' "$BASE/lab.env"; then
  echo "→ append NEXT_PUBLIC_ENABLE_MSW=false to existing $BASE/lab.env"
  umask 077
  printf 'NEXT_PUBLIC_ENABLE_MSW=false\n' >> "$BASE/lab.env"
  printf 'NEXT_PUBLIC_API_BASE_URL=\n' >> "$BASE/lab.env"
fi
# 兼容旧 lab.env:已存在但缺 SAAS_BASE_URL,追加(不覆盖 AUTH_JWT_SECRET)
if [ -f "$BASE/lab.env" ] && ! grep -q '^SAAS_BASE_URL=' "$BASE/lab.env"; then
  echo "→ append SAAS_BASE_URL to existing $BASE/lab.env"
  umask 077
  {
    printf 'SAAS_BASE_URL=%s\n' "${SAAS_BASE_URL:-https://saas-react.xiangru.uk}"
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "${NEXT_PUBLIC_SAAS_BASE_URL:-https://saas-react.xiangru.uk}"
    printf 'SAAS_OAUTH_CLIENT_ID=%s\n' "${SAAS_OAUTH_CLIENT_ID:-lab-management}"
    printf 'NEXT_PUBLIC_SAAS_APP_ID=%s\n' "${NEXT_PUBLIC_SAAS_APP_ID:-app-lab}"
  } >> "$BASE/lab.env"
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
