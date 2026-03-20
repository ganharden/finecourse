#!/bin/bash
# FineCourse - 推送到 GitHub 并触发 APK 构建
# GitHub 用户名: ganharden

set -e

APP_DIR="/home/harden/.openclaw/workspace/course-newsystem"
REPO_NAME="finecourse"
GITHUB_USER="ganharden"

echo "=================================="
echo "FineCourse - 推送到 GitHub"
echo "=================================="
echo ""

cd "$APP_DIR"

# 检查 Git 状态
if [ -z "$(git remote -v)" ]; then
    echo "初始化 Git 仓库..."
    git init
    
    # 检查分支是否存在
    if ! git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
        git checkout -b main 2>/dev/null || git branch -m main
    fi
    
    echo "添加仓库文件..."
    git add .
    
    echo "创建提交..."
    git commit -m "Initial commit: FineCourse APK ready for build"
    
    echo "添加远程仓库..."
    git remote add origin https://github.com/${GITHUB_USER}/${REPO_NAME}.git
fi

# 推送到 GitHub
echo "正在推送到 GitHub..."
git push -u origin main

echo ""
echo "=================================="
echo "✓ 代码已推送到 GitHub！"
echo "=================================="
echo ""
echo "下一步：触发构建"
echo "1. 访问: https://github.com/${GITHUB_USER}/${REPO_NAME}/actions"
echo "2. 点击 'Build APK' 工作流"
echo "3. 点击 'Run workflow' → 'Run workflow'"
echo "4. 等待构建完成（约 5-10 分钟）"
echo "5. 下载 'FineCourse-APK' 工件"
echo ""
