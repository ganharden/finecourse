# FineCourse - APK 构建说明

## 📱 项目信息

- **应用名称**：FineCourse
- **包名**：com.finecourse.app
- **版本**：1.0.0

## 🚀 构建 APK 的两种方式

### 方式一：GitHub Actions（自动化）

1. **推送代码到 GitHub**
```bash
cd /home/harden/.openclaw/workspace/course-newsystem
git init
git add .
git commit -m "Initial commit: FineCourse APK"
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

2. **配置 GitHub Secrets**（可选，用于签名）
   - 进入仓库的 Settings → Secrets and variables → Actions
   - 添加密钥（如果需要自定义签名）

3. **触发构建**
   - 推送代码后，GitHub Actions 会自动构建
   - 或手动在 Actions 标签页点击 "Run workflow"

4. **下载 APK**
   - 构建完成后，点击工作流
   - 下载 "FineCourse-APK" 工件

---

### 方式二：本地 Docker 构建（手动）

1. **安装 Docker**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

2. **运行构建脚本**
```bash
cd /home/harden/.openclaw/workspace/course-newsystem
./build-apk-online.sh
```

3. **下载 APK**
   - APK 会生成在 `course-newsystem/FineCourse-debug.apk`

---

## 📲 安装到手机

### Android 安装步骤：

1. **传输 APK 到手机**
   - 通过 USB 传输
   - 或通过 Telegram/微信/邮箱发送

2. **安装**
   - 允许"安装未知来源应用"
   - 点击 APK 文件安装

3. **运行**
   - 打开 FineCourse 应用
   - 首次启动可能需要几秒加载

---

## 🔧 技术栈

- **前端**：HTML + CSS + JavaScript
- **打包工具**：Capacitor
- **构建工具**：Gradle
- **平台**：Android

---

## 📝 构建配置

- **App ID**：com.finecourse.app
- **App Name**：FineCourse
- **端口**：8080 (前端), 3001 (后端 API)

---

## 🆘 故障排查

### GitHub Actions 构建失败？

- 检查 `frontend` 目录是否有 `www` 子目录
- 确保 `index.html`, `manifest.json`, `sw.js` 已复制到 `www/`

### 无法安装 APK？

- 检查手机设置 → 允许"安装未知来源应用"
- 尝试清除浏览器缓存后重新下载

---

**有问题随时问！** 🦞
