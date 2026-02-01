# 连连 (LianLian) - 远程控制软件

## 简介
连连是一款基于 Rust + Tauri + Vue3 开发的跨平台远程控制软件，旨在提供更安全、低延迟的远程连接体验。

## 技术栈
- **核心**: Rust (Tauri)
- **前端**: Vue 3 + TypeScript + Vite
- **通信**: WebRTC (计划中) / P2P NAT穿透

## 开发指南

### 1. 环境准备
- Node.js (v16+)
- Rust (最新稳定版)
- pnpm / npm / yarn

### 2. 安装依赖
```bash
npm install
```

### 3. 运行开发环境
```bash
# 启动 Tauri 桌面端开发环境
npm run tauri dev

# 仅启动前端
npm run dev
```

### 4. 构建发布
```bash
# 构建 macOS 应用 (.dmg / .app)
npm run tauri build

# 构建 Windows 应用 (.msi / .exe)
npm run tauri build --target x86_64-pc-windows-msvc
```

## 目录结构
- `src-tauri`: Rust 后端代码
- `src`: Vue 前端代码
- `dist`: 前端构建产物

## 贡献
欢迎提交 Issue 和 PR！
