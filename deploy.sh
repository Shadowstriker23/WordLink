#!/usr/bin/env bash
# WordLink 部署脚本 (Debian 12/13 + Ubuntu)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_USER="${SUDO_USER:-$(whoami)}"
NODE_MIN=20

# ── 检查 ──────────────────────────────────────────────
echo "==> 环境检查"

if ! command -v node >/dev/null 2>&1; then
  echo "  未找到 Node.js，请先安装 Node.js ${NODE_MIN}+"
  echo "  Debian/Ubuntu:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "    sudo apt-get install -y nodejs"
  echo "  或使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  exit 1
fi

NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_MAJOR" -lt "$NODE_MIN" ]; then
  echo "  Node.js 版本过低: v${NODE_MAJOR}，需要 ${NODE_MIN}+"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "  安装 pnpm..."
  npm install -g pnpm
fi

# ── 系统依赖 (better-sqlite3 编译所需) ────────────
if [ "$(id -u)" = "0" ]; then
  apt-get update -qq
  apt-get install -y -qq python3 make gcc g++ 2>/dev/null || true
elif command -v sudo >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3 make gcc g++ 2>/dev/null || true
fi

# ── 配置文件 ─────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo "  创建 .env（请编辑填入 DEEPSEEK_API_KEY）"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

# ── 安装依赖 ──────────────────────────────────────────
echo "==> 1/4 安装 npm 依赖"
cd "$APP_DIR"
sudo -u "$APP_USER" pnpm install --prod=false

# ── 数据库 ─────────────────────────────────────────────
echo "==> 2/4 初始化数据库"
sudo -u "$APP_USER" pnpm exec prisma generate
sudo -u "$APP_USER" pnpm exec prisma db push

# ── 词典库 ─────────────────────────────────────────────
if [ ! -f "$APP_DIR/data/ecdict.db" ]; then
  echo "==> 2.5/4 构建词典库"
  if [ -f "$APP_DIR/ecdict.csv" ]; then
    echo "  找到 ecdict.csv，正在导入（约耗时 1-2 分钟）..."
    sudo -u "$APP_USER" node --max-old-space-size=1024 "$APP_DIR/scripts/import-ecdict.mjs"
  else
    echo "  正在下载 ECDICT 词典数据（约 65MB）..."
    curl -L --retry 3 --max-time 300 \
      -o "$APP_DIR/ecdict.csv" \
      "https://ghfast.top/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv" \
      || echo "  下载失败，跳过词典构建（标签检索将缺失词典释义）"
    if [ -f "$APP_DIR/ecdict.csv" ]; then
      sudo -u "$APP_USER" node --max-old-space-size=1024 "$APP_DIR/scripts/import-ecdict.mjs"
      rm "$APP_DIR/ecdict.csv"
    fi
  fi
fi

# ── 构建 ────────────────────────────────────────────────
echo "==> 3/4 构建生产版本"
sudo -u "$APP_USER" pnpm build

# ── 进程管理 ──────────────────────────────────────────
echo "==> 4/4 启动服务"

if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload "$APP_DIR/ecosystem.config.js" --env production
  pm2 save
  echo ""
  echo "部署完成！"
  echo "  PM2 状态: pm2 status"
  echo "  查看日志: pm2 logs wordlink"
  echo "  应用地址: http://$(hostname -I | awk '{print $1}'):3000"
else
  echo "  PM2 未安装。你可以:"
  echo "    npm install -g pm2 && pm2 start ecosystem.config.js"
  echo "  或直接运行:"
  echo "    pnpm start"
  echo "  或使用 systemd 服务（见 README）"
fi
