# 📱 FineCourse PWA 安装指南

你的课程管理系统现在已经支持 **PWA (渐进式 Web 应用)** 了！

## ✅ 已完成的配置

- [x] Service Worker (`sw.js`) - 支持离线缓存
- [x] Web App Manifest (`manifest.json`) - 应用元数据
- [x] 应用图标 (192x192, 512x512)
- [x] 移动端 viewport 优化
- [x] iOS Safari 兼容标签

---

## 🚀 如何在手机上安装

### 方式一：本地网络访问（推荐先测试）

1. **启动后端服务**
   ```bash
   cd /home/harden/.openclaw/workspace/course-newsystem/backend
   node server.js
   ```

2. **启动前端服务**
   ```bash
   cd /home/harden/.openclaw/workspace/course-newsystem/frontend
   npx http-server -p 8080
   ```

3. **获取你的电脑 IP 地址**
   ```bash
   ip addr show | grep "inet " | grep -v 127.0.0.1
   # 或者
   hostname -I
   ```

4. **手机访问**
   - 确保手机和电脑在同一 WiFi 网络
   - 手机浏览器访问：`http://你的电脑IP:8080`

### 方式二：部署到公网（需要 HTTPS）

PWA 要求 **HTTPS** 环境才能安装。可以使用：

- **Cloudflare Tunnel**（免费，推荐）
- **ngrok**（临时测试）
- **Vercel/Netlify**（静态部署）

---

## 📲 安装到手机桌面

### Android (Chrome)

1. 访问网站后，浏览器会自动弹出"添加到主屏幕"提示
2. 或者点击右上角菜单 → **"添加到主屏幕"**
3. 确认后，应用会出现在手机桌面

### iOS (Safari)

1. 访问网站
2. 点击底部 **分享按钮** (正方形 + 向上箭头)
3. 向下滑动，点击 **"添加到主屏幕"**
4. 点击右上角 **"添加"**

---

## 🎯 PWA 特性

- ✅ **离线使用** - 缓存的核心资源可在无网络时使用
- ✅ **桌面图标** - 像原生应用一样显示在桌面
- ✅ **全屏模式** - 打开时没有浏览器地址栏
- ✅ **快速启动** - 比传统网页加载更快

---

## ⚠️ 注意事项

1. **首次访问需要网络** - Service Worker 需要先缓存资源
2. **HTTPS 要求** - 生产环境必须使用 HTTPS 才能安装
3. **缓存更新** - 修改代码后需要更新 `CACHE_NAME` 版本号

---

## 🛠️ 下一步优化建议

- [ ] 添加离线提示页面
- [ ] 实现后台数据同步
- [ ] 添加推送通知支持
- [ ] 使用 Capacitor 打包成原生 APK

---

**有问题随时问我！** 🦞
