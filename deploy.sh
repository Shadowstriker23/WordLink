#!/usr/bin/env bash
# WordLink 部署脚本 (Ubuntu/Debian)
set -euo pipefail

APP_DIR="/opt/wordlink"
APP_USER="${SUDO_USER:-$(whoami)}"

echo "==> 1/5 安装依赖"
cd "$APP_DIR"
sudo -u "$APP_USER" pnpm install --prod=false

echo "==> 2/5 生成 Prisma Client"
sudo -u "$APP_USER" pnpm exec prisma generate

echo "==> 3/5 同步数据库"
sudo -u "$APP_USER" pnpm exec prisma db push

echo "==> 3.5/5 构建词典库（如果还没有）"
if [ ! -f "$APP_DIR/data/ecdict.db" ]; then
  if [ -f "$APP_DIR/ecdict.csv" ]; then
    echo "  从 ecdict.csv 构建词典（约 100MB，需几分钟）..."
    sudo -u "$APP_USER" pnpm db:dict
  else
    echo "  未找到 ecdict.csv，跳过（标签检索的词典功能将不可用）"
    echo "  下载方式见 README.md"
  fi
fi

echo "==> 4/5 构建"
sudo -u "$APP_USER" pnpm build

echo "==> 5/5 重启 PM2"if ! command -v pm2 >/dev/null 2>&1; then
  echo "  安装 PM2..."
  sudo npm install -g pm2
fi
pm2 startOrReload "$APP_DIR/ecosystem.config.js" --env production
pm2 save

echo ""
echo "部署完成！"
echo "  PM2 状态: pm2 status"
echo "  日志查看: pm2 logs wordlink"
echo "  应用地址: http://$(hostname -I | awk '{print $1}'):3000"
