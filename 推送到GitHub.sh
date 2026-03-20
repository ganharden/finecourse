#!/bin/bash
# FineCourse - 推送到 GitHub
# GitHub 用户名: ganharden
# 仓库名: finecourse

cd /home/harden/.openclaw/workspace/course-newsystem

# 推送到 GitHub（替换为你创建的仓库 URL）
git remote set-url origin https://github.com/ganharden/finecourse.git
git push -u origin main
