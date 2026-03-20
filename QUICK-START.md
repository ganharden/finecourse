# GitHub Actions - 构建 APK

你的代码已经准备好了！以下是完整的构建流程：

## 🚀 快速开始（5 分钟）

### 步骤 1：推送到 GitHub

运行这个命令来初始化并推送代码：

```bash
cd /home/harden/.openclaw/workspace/course-newsystem

# 初始化 Git（如果还没初始化）
git init

# 添加所有文件
git add .

# 创建第一个提交
git commit -m "Initial commit: FineCourse APK ready for build"

# 添加你的 GitHub 仓库（替换 <你的用户名> 和 <仓库名>）
git remote add origin https://github.com/<你的用户名>/<仓库名>.git

# 推送到 GitHub
git push -u origin main
```

---

### 步骤 2：在 GitHub Actions 构建

1. 访问：`https://github.com/<你的用户名>/<仓库名>/actions`

2. 点击左侧面板的 **"Build APK"**

3. 点击右上角 **"Run workflow"** → **"Run workflow"**

4. 等待构建完成（约 5-10 分钟）

5. 构建完成后，点击工作流 → 下载 **"FineCourse-APK"** 工件

---

### 步骤 3：安装到手机

1. **下载 APK** 到手机
   - 通过 USB 传输
   - 或通过微信/QQ/Telegram 发送

2. **安装**
   - 允许"安装未知来源应用"
   - 点击 APK 文件安装

---

## 🔧 配置文件说明

### 已创建的文件：

| 文件 | 说明 |
|------|------|
| `.github/workflows/build-apk.yml` | GitHub Actions 构建配置 |
| `build-apk.sh` | 本地 Docker 构建脚本 |
| `build-apk-online.sh` | 在线构建脚本 |
| `push-and-build.sh` | 一键推送和触发构建 |
| `APK-BUILD-GUIDE.md` | 完整构建指南 |

---

## 🎯 推荐方式

**对于你的情况，我推荐：**

1. ✅ 先用 GitHub Actions 构建（我已经配置好了）
2. 如果 GitHub 构建失败，再用 Codemagic（更简单，不需要配置）

---

## 📱 Codemagic（备用方案）

如果 GitHub Actions 构建有问题，可以用 Codemagic：

1. 访问 https://codemagic.io
2. 注册账号（免费）
3. 连接 GitHub 仓库
4. Codemagic 会自动构建并提供下载链接

---

**需要我帮你生成 Git 初始化命令吗？**
告诉我你的 GitHub 用户名和想要的仓库名，我帮你生成完整的推送命令！ 🦞
