#!/bin/sh
# setup-vps.sh — VPS 一次性 bootstrap(Ubuntu/Debian)— lab-management-system-nextjs
#
# 用法:
#   sudo sh deploy/setup-vps.sh lab.example.com
#
# 照抄姊妹仓 saas-identity-platform 的 setup-vps.sh;同一台 VPS 已跑过 saas 版的话,
# 1/2 两步会自动跳过(幂等)。lab 特有的是 data/ 卷目录与 lab.env 密钥文件。
#
# 这个脚本干这些事:
#   1. apt 装 nginx、docker(如未装)
#   2. 创建 deploy 用户(key-only SSH)+ 加进 docker 组
#   3. 建 /home/deploy/lab-management-system-nextjs/{,data}
#   4. 生成 lab.env(AUTH_JWT_SECRET 随机;已存在则不动)
#   5. 渲染 deploy/nginx-vps.conf.example → /etc/nginx/sites-available/$DOMAIN
#   6. 启用 sites-enabled symlink;删 Ubuntu 默认页避免 default_server 冲突
#   7. nginx -t && reload
#
# 你**还要做**的(不在脚本里):
#   a) 把 .crt / .key 放到 /etc/nginx/ssl/your-cert.{crt,key}(复用 saas 的 cert 则跳过)
#   b) 本地跑:ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@VPS(saas 已做则跳过)
#   c) lab repo 的 GitHub Repository Secrets 加:
#        DOCKER_USERNAME / DOCKER_PASSWORD / VPS_HOST / VPS_USER / VPS_SSH_KEY

set -eu

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <lab.example.com>" >&2
  exit 1
fi

BASE="/home/deploy/lab-management-system-nextjs"

log() { printf '→ %s\n' "$*"; }

# ── 1. 系统包 ─────────────────────────────────────
if ! command -v nginx >/dev/null 2>&1; then
  log "install nginx"
  apt-get update
  apt-get install -y nginx
fi
if ! command -v docker >/dev/null 2>&1; then
  log "install docker.io"
  apt-get install -y docker.io
fi

# ── 2. deploy 用户(无密码、SSH key only) ─────────
if ! id deploy >/dev/null 2>&1; then
  log "create deploy user"
  adduser --disabled-password --gecos "" --shell /bin/bash deploy
fi
log "ensure deploy in docker group"
usermod -aG docker deploy

# ── 3. 部署目录 + 数据卷目录 ───────────────────────
log "create $BASE/{,data}"
sudo -u deploy mkdir -p "$BASE/data"

# cert 目录占位
mkdir -p /etc/nginx/ssl
chmod 700 /etc/nginx/ssl

# ── 4. lab.env(密钥只落 VPS,不进仓库/CI) ────────
# 一次性写入 LAB_JWT_SECRET(随机;factory.ts 读这个名,老 AUTH_JWT_SECRET 是死键)
# + SAAS_BASE_URL/NEXT_PUBLIC_SAAS_BASE_URL(固定生产值)
# SAAS_BASE_URL 走生产 https://saas-nextjs.xiangru.uk;Next.js 前缀注入浏览器。
# 这里**不**依赖 shell env 而写死生产 URL,与 .env.example 配套(模板里有 LOCAL 例子)。
if [ ! -f "$BASE/lab.env" ]; then
  log "generate $BASE/lab.env (LAB_JWT_SECRET + SAAS_BASE_URL)"
  SECRET="$(openssl rand -hex 32)"
  printf 'LAB_JWT_SECRET=%s\n' "$SECRET" > "$BASE/lab.env"
  printf 'SAAS_BASE_URL=%s\n' "https://saas-nextjs.xiangru.uk" >> "$BASE/lab.env"
  printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "https://saas-nextjs.xiangru.uk" >> "$BASE/lab.env"
  chown deploy:deploy "$BASE/lab.env"
  chmod 600 "$BASE/lab.env"
else
  log "keep existing $BASE/lab.env (verify SAAS_BASE_URL presence)"
  if ! grep -q '^SAAS_BASE_URL=' "$BASE/lab.env"; then
    log "append SAAS_BASE_URL to existing lab.env (no LAB_JWT_SECRET overwrite)"
    printf 'SAAS_BASE_URL=%s\n' "https://saas-nextjs.xiangru.uk" >> "$BASE/lab.env"
    printf 'NEXT_PUBLIC_SAAS_BASE_URL=%s\n' "https://saas-nextjs.xiangru.uk" >> "$BASE/lab.env"
  fi
fi

# ── 5. 渲染 nginx vhost template ───────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/nginx-vps.conf.example"
if [ ! -f "$TEMPLATE" ]; then
  echo "Missing template: $TEMPLATE" >&2
  echo "Either run this from the deploy/ directory or git checkout first." >&2
  exit 2
fi

TARGET="/etc/nginx/sites-available/${DOMAIN}"
log "render → $TARGET"
sed "s/lab.YOUR_DOMAIN/${DOMAIN}/g" "$TEMPLATE" > "$TARGET"

# ── 6. 启用 + 解决 default_server 冲突 ───────────────
log "enable site, drop sites-enabled/default"
ln -sf "$TARGET" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

# ── 7. nginx 检查 + reload ─────────────────────────
log "nginx -t"
nginx -t
log "reload"
systemctl reload nginx

log "VPS 配置完成"
log "剩下手工:"
log "  1) cert:/etc/nginx/ssl/your-cert.{crt,key}(复用 saas 的可跳过)"
log "  2) ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@$(hostname -I | awk '{print $1}')(saas 已做可跳过)"
log "  3) lab repo GitHub Secrets: DOCKER_USERNAME / DOCKER_PASSWORD / VPS_HOST / VPS_USER / VPS_SSH_KEY"
