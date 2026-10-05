# PiForge Desktop

纯本地 AI 开发平台桌面客户端。基于 pi-agent SDK 驱动 Agent 运行时，DeepSeek 作为默认模型。

**形态约束：纯本地。** 无服务端、无远程网关、无多用户认证。所有能力在用户机器上运行。

## 技术栈

| 层 | 选型 |
|----|------|
| 壳 | Electron 44 |
| 构建 | electron-vite 5 |
| UI | React 19 + TypeScript 5 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| Agent 运行时 | `@earendil-works/pi-coding-agent` |
| 模型 | DeepSeek（`deepseek-flash` / `deepseek-v4-pro`） |

## 环境要求

- **Node ≥ 20.19**（vite 7 依赖 `crypto.hash`，20.6 会报 `crypto.hash is not a function`）
- pnpm ≥ 10

## 快速开始

```bash
pnpm install
pnpm dev          # 启动开发（vite dev server + Electron）
pnpm build        # 构建产物
pnpm typecheck    # 类型检查
```

## 四层进程模型

1. **Renderer**（`src/renderer/`）：只负责 UI，严禁直接访问 Node.js API。
2. **Main**（`src/main/`）：窗口/生命周期/工作区/凭据，管理 Utility Process 与 Sandbox。
3. **Agent Utility Process**（`src/agent/`）：运行 pi-agent SDK，管理 AgentSession 与工具执行。
4. **Sandbox Process**：执行 LLM 生成的代码与 shell 命令（受限子进程 / 可选 Docker）。

## 关键决策（阶段一对齐）

| 项 | 决策 |
|----|------|
| 模型 ID | `deepseek-flash`、`deepseek-v4-pro`（**不是** `deepseek-v4-flash`，该 ID 不存在） |
| 会话模式 | **默认持久化**（便于会话恢复）；临时会话才用 `SessionManager.inMemory()` |
| 配置目录 | SDK 默认 `~/.pi/agent/`（全局共享），主进程首次启动确保目录存在 |
| 工具注册 | 静态内置工具走 `createAgentSession({ customTools })`；热插拔工具走 Extension（`~/.pi/agent/extensions/`）。两者共存 |
| 安全配置 | 每个 BrowserWindow：`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false` |
| API Key | Electron `safeStorage` 加密存储，禁止 localStorage |

## 目录结构

```
src/
├─ main/       Electron 主进程（窗口、Agent host、Sandbox host、凭据、trace）
├─ preload/    contextBridge 白名单 API
├─ agent/      pi-agent SDK 运行时（session、events、tools）
├─ renderer/   React UI（Chat/ToolCall/Terminal/Editor/FileTree/Approval/...）
└─ shared/     IPC 类型与 Agent 事件类型
```
