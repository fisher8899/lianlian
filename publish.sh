#!/bin/bash

# 检查是否输入了版本号
if [ -z "$1" ]; then
  echo "❌ 错误: 请输入版本号 (例如: 0.1.5)"
  echo "👉 用法: ./publish.sh 0.1.5"
  exit 1
fi

VERSION=$1
TAG="v$VERSION"

echo "🚀 开始发布连连 (LianLian) $TAG ..."

# 1. 提交所有代码
echo "📦 提交代码中..."
git add .
git commit -m "Release $TAG"
git push origin main

# 2. 打标签并推送
echo "🏷️  创建标签 $TAG ..."
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "⚠️  标签 $TAG 已存在，跳过创建标签步骤。"
else
    git tag "$TAG"
    git push origin "$TAG"
fi

echo "✅ 发布成功！GitHub Actions 正在云端构建安装包。"
echo "🔗 查看进度: https://github.com/fisher8899/lianlian/actions"
