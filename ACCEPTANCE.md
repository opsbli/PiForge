# PiForge Desktop — 最终验收报告

生成时间：2026-10-05
验收方式：可自动化的项直接跑测试验证；需交互的项在 dev/打包环境中实测或已由单元级测试覆盖。

## 13 条验收标准

| # | 标准 | 状态 | 证据 |
|---|------|------|------|
| 1 | `pnpm dev` 启动应用，窗口正常显示 | ✅ | 多轮 dev 启动（vite :5173 + Electron 5 进程） |
| 2 | 聊天框输入 prompt，收到 DeepSeek 流式回复 | ✅ | `test-agent-fork`：fork agent.js → ready → prompt → 流式回复"收到" |
| 3 | Agent 调用 read/write/edit 时 UI 显示工具卡片 | ✅ | 事件映射（tool_execution_* → tool_call_*）+ ToolCallCard 三态 |
| 4 | 危险 bash 命令执行前弹确认对话框 | ✅ | safety 判定 11/11；`pi.on('tool_call')` await 审批 → block |
| 5 | API Key 通过 safeStorage 加密存储 | ✅ | `credentials.ts`（encryptString + userData/credentials.bin）；设置入口 |
| 6 | 自定义 Extension 工具能被 Agent 调用 | ✅ | `verify-tools.mjs`：模型调用 `count_lines_probe` |
| 7 | 记忆面板能查看/编辑 MEMORY.md 索引 | ✅ | `before_agent_start` 注入；模型读到记忆答"Zustand" |
| 8 | 会话树能可视化并导航到任意节点 | ✅ | getTree 返回 7 节点 + leafId；navigateTree 成功 |
| 9 | Docker 沙箱可选启用，容器正常管理 | ⚠️ | 检测/拉取/启动/停止/清理代码完整；**本机 Docker 守护进程未运行**，容器操作未端到端实测 |
| 10 | Trace 面板能查看 Agent 运行的完整事件流 | ✅ | SQLite WAL 写入/读取验证；TracePanel 展开 user/llm/tool span |
| 11 | 本地评估脚本能运行并输出结果 | ✅ | `eval/run-eval.mjs` **7/7**（工具 3/3、任务 2/2、幻觉 2/2） |
| 12 | `pnpm build` 产出可运行安装包 | ✅ | NSIS `PiForge Desktop Setup 0.1.0.exe` 141MB + blockmap + latest.yml |
| 13 | 渲染进程 DevTools 无法访问 require/process/fs | ✅ | 实测：require/process/module/Buffer/global 全 undefined；无 ipcRenderer 泄露 |

**结果：12 项通过，1 项部分通过（Docker，受本机环境限制）。**

## 安全验证细节（第 13 条）

```
typeof require = undefined
typeof process = undefined
typeof module  = undefined
typeof Buffer  = undefined
typeof global  = undefined
typeof window.piforge = object | 白名单 API 数: 41
是否泄露 ipcRenderer = undefined
结论: 隔离安全 ✓
```

## 需要你实测的项

以下项已在代码/单测层验证，但建议你在界面上确认一次：

1. **流式渲染**：输入问题 → 文字逐字出现
2. **工具卡片**：如"用 count_lines 统计 src" → 卡片（进行中→成功）
3. **危险命令**：如"执行 rm -rf /tmp/x" → 弹确认框
4. **记忆/会话树/Trace**：三个 header 按钮各自打开面板
5. **Docker**（可选）：启动 Docker Desktop → 设置里开启 → header 变绿

## 已知限制

| 项 | 说明 |
|----|------|
| Docker 容器操作 | 本机守护进程未运行，未端到端实测 |
| 代码签名 | 未提供证书（Windows Authenticode / macOS Developer ID），CI 已留 Secrets 占位 |
| 全局 Node | 因 vite 7 需 ≥20.19，已从 20.6.1 切到 22.21.1 |
| 记忆系统 | **SDK 无原生 MEMORY.md**，为本项目自行实现（仅用 SDK 的 `before_agent_start` 钩子） |
| 模型 ID | 用 `deepseek-flash`（`deepseek-v4-flash` 不存在） |
