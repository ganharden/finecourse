#!/bin/bash

# FineCourse APK 在线构建脚本（使用 Codemagic CLI）
# 这个脚本用于在没有 Android SDK 的情况下构建 APK

set -e

APP_DIR="/home/harden/.openclaw/workspace/course-newsystem"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=================================="
echo "FineCourse APK 在线构建脚本"
echo "=================================="
echo ""
echo "-description:"
echo "  本脚本使用 Codemagic CLI 在本地构建 APK，"
echo "  无需安装 Android Studio，但需要 Docker。"
echo ""
echo "用法: $0"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 未找到 Docker，请先安装 Docker"
    echo "安装指南: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker found"
echo ""

# 创建构建配置
create_config() {
    cat > "$FRONTEND_DIR/capacitor.config.prod.json" << EOF
{
  "appId": "com.finecourse.app",
  "appName": "FineCourse",
  "webDir": "www",
  "bundledWebRuntime": false,
  "android": {
    "buildOptions": {
      "keystorePath": "$HOME/.android/debug.keystore",
      "keystorePassword": "android",
      "keystoreAlias": "androiddebugkey",
      "keystoreAliasPassword": "android"
    }
  }
}
EOF
    echo "✓ 构建配置已创建"
}

# 使用 Docker 构建（模拟 Codemagic 环境）
build_with_docker() {
    echo "=================================="
    echo "开始构建 APK（使用 Docker）..."
    echo "=================================="
    
    cd "$FRONTEND_DIR"
    
    # 复制资源
    cp -f index.html www/
    cp -f manifest.json www/
    cp -f sw.js www/
    cp -f icon-*.png www/
    
    # 拉取 Android 构建镜像
    echo "拉取 Android 构建镜像..."
    docker pull androidsdk/android-34:latest
    
    echo "开始构建..."
    docker run --rm \
        -v "$(pwd)":/app \
        -v "$HOME/.gradle":/root/.gradle \
        -w /app/android \
        androidsdk/android-34:latest \
        bash -c "./gradlew assembleDebug"
    
    # 检查结果
    DEBUG_APK="$FRONTEND_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
    
    if [ -f "$DEBUG_APK" ]; then
        echo "=================================="
        echo "✓ APK 构建完成！"
        echo "=================================="
        echo "Debug APK 位置: $DEBUG_APK"
        echo "文件大小: $(ls -lh "$DEBUG_APK" | awk '{print $5}')"
        
        # 复制到根目录
        cp "$DEBUG_APK" "$APP_DIR/FineCourse-debug.apk"
        echo "已复制到: $APP_DIR/FineCourse-debug.apk"
    else
        echo "❌ APK 构建失败"
        exit 1
    fi
}

main() {
    create_config
    build_with_docker
}

main
