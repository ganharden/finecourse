# FineCourse - APK 构建脚本

#!/bin/bash

# 自动化 GitHub 推送和构建触发脚本

set -e

APP_DIR="/home/harden/.openclaw/workspace/course-newsystem"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=================================="
echo "FineCourse APK 构建脚本"
echo "=================================="
echo ""

# 检查前端资源
echo "检查前端资源..."
if [ ! -f "$FRONTEND_DIR/www/index.html" ]; then
    echo "❌ www/index.html 不存在，正在创建..."
    mkdir -p "$FRONTEND_DIR/www"
    cp -f "$FRONTEND_DIR/index.html" "$FRONTEND_DIR/www/"
    cp -f "$FRONTEND_DIR/manifest.json" "$FRONTEND_DIR/www/"
    cp -f "$FRONTEND_DIR/sw.js" "$FRONTEND_DIR/www/"
    cp -f "$FRONTEND_DIR/icon-*.png" "$FRONTEND_DIR/www/"
    echo "✓ www 资源已创建"
else
    echo "✓ www 资源已就位"
fi

# 推送到 GitHub
echo ""
echo "准备推送到 GitHub..."

if ! command -v git &> /dev/null; then
    echo "❌ 未找到 Git，请先安装 Git"
    exit 1
fi

cd "$APP_DIR"

# 检查是否已有 GitHub 仓库
if [ -z "$(git remote -v)" ]; then
    echo ""
    echo "⚠️  未检测到 GitHub 仓库配置"
    echo ""
    echo "请按以下步骤操作："
    echo "1. 访问 https://github.com/new 创建新仓库"
    echo "2. 仓库名建议：finecourse"
    echo "3. 仓库类型：Public（免费）"
    echo "4. 创建后，运行以下命令："
    echo ""
    echo "   cd $APP_DIR"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit: FineCourse APK'"
    echo "   git remote add origin <你的仓库URL>"
    echo "   git push -u origin main"
    echo ""
    echo "或运行 GitHub CLI（如果有安装）："
    echo "   gh repo create finecourse --public --source=. --remote=origin"
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# 检查是否有未提交的更改
if ! git diff --exit-code >/dev/null 2>&1; then
    echo "检测到未提交的更改，正在提交..."
    git add .
    git commit -m "Update for APK build $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 推送代码
echo "正在推送到 GitHub..."
git push -u origin main

echo ""
echo "=================================="
echo "✓ 代码已推送到 GitHub！"
echo "=================================="
echo ""
echo "下一步："
echo "1. 访问 https://github.com/<你的用户名>/finecourse/actions"
echo "2. 点击 'Build APK' 工作流"
echo "3. 点击 'Run workflow' → 'Run workflow'"
echo "4. 等待构建完成（约 5-10 分钟）"
echo "5. 下载生成的 APK 文件"
echo ""
echo "或访问 Codemagic 构建："
echo "1. 访问 https://codemagic.io/applications"
echo "2. 连接你的 GitHub 仓库"
echo "3. Codemagic 会自动检测并构建"
echo ""
