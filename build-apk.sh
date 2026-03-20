#!/bin/bash

# FineCourse APK 构建脚本
# 使用前请确保已安装 Android Studio 和 Android SDK

set -e

APP_DIR="/home/harden/.openclaw/workspace/course-newsystem"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"

echo "=================================="
echo "FineCourse APK 构建脚本"
echo "=================================="

# 检查环境
check_env() {
    if [ ! -d "$FRONTEND_DIR/android" ]; then
        echo "❌ Android 项目不存在，正在初始化..."
        cd "$FRONTEND_DIR"
        npx cap add android
    fi
    
    if [ ! -d "$ANDROID_HOME" ]; then
        echo "❌ 未找到 Android SDK，请先安装 Android Studio"
        echo "下载地址: https://developer.android.com/studio"
        exit 1
    fi
    
    echo "✓ Android SDK found at $ANDROID_HOME"
}

# 同步前端资源
sync_resources() {
    echo "=================================="
    echo "同步前端资源..."
    echo "=================================="
    
    cd "$FRONTEND_DIR"
    
    # 复制资源到 www 目录
    cp -f index.html www/
    cp -f manifest.json www/
    cp -f sw.js www/
    cp -f icon-*.png www/
    
    # 同步到 Android 项目
    npx cap sync
    
    echo "✓ 资源同步完成"
}

# 构建 APK
build_apk() {
    echo "=================================="
    echo "构建 APK..."
    echo "=================================="
    
    cd "$FRONTEND_DIR/android"
    
    # 设置环境变量
    export ANDROID_HOME="$ANDROID_HOME"
    export PATH="$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools"
    
    # 构建 Debug APK
    echo "构建 Debug APK..."
    ./gradlew assembleDebug
    
    # 构建 Release APK（如果需要）
    # ./gradlew assembleRelease
    
    echo "=================================="
    echo "✓ APK 构建完成！"
    echo "=================================="
    
    DEBUG_APK="$FRONTEND_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
    
    if [ -f "$DEBUG_APK" ]; then
        echo "Debug APK 位置: $DEBUG_APK"
        echo "文件大小: $(ls -lh "$DEBUG_APK" | awk '{print $5}')"
        
        # 复制到根目录方便查找
        cp "$DEBUG_APK" "$APP_DIR/FineCourse-debug.apk"
        echo "已复制到: $APP_DIR/FineCourse-debug.apk"
    fi
}

# 安装到连接的设备
install_to_device() {
    echo "=================================="
    echo "安装到设备..."
    echo "=================================="
    
    adb install -r "$FRONTEND_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
}

# 主流程
main() {
    case "$1" in
        sync)
            sync_resources
            ;;
        build)
            check_env
            sync_resources
            build_apk
            ;;
        install)
            check_env
            install_to_device
            ;;
        *)
            echo "用法: $0 {sync|build|install}"
            echo ""
            echo "命令:"
            echo "  sync    - 同步前端资源到 Android 项目"
            echo "  build   - 构建 APK（需要 Android SDK）"
            echo "  install - 安装到连接的设备"
            echo ""
            echo "示例:"
            echo "  ./build-apk.sh build"
            echo ""
            echo "注意: 构建前请确保已安装 Android Studio 并配置 ANDROID_HOME 环境变量"
            ;;
    esac
}

main "$@"
