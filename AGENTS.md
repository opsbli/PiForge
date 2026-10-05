<!--
  本文件由 pax-init@0.2.0 生成（2026-10-05）。
  生成方式：扫描本项目特征文件 → 用户确认 → 渲染 pax-init 的 AGENTS.md 模板。
  产物契约：与本项目 .pax/project-profile.json 同源；两者字段必须一致。
  重新生成：在 PiForge 根目录触发 pax-init（skills 位置 .pi/skills/pax-init/）。
-->

# AGENTS.md — PiForge Desktop

> **本文件是 AI 工具在此项目中协作的强制规范。** 生成时间：2026-10-05T12:24+08:00
> AI 工具加载本文件后，MUST 遵循以下全部规则。

---

## ⭐ pax-family 强制规则（最高优先级 · 高于以下所有章节）

> 本节是 pax-family 的入口守门规则。没有这一节，AI 容易绕过编排入口直接执行，导致风险分级缺失、产物散落。

- **对任何用户请求，MUST 先经过 pax-family 的 L0 编排入口做意图分类与风险分级，NEVER 直接执行。**
- 编排入口位置：`.pi/skills/pax-orchestrate/SKILL.md`
- 编排入口产出任务快照后，按快照的路由建议调度对应阶段；NEVER 跳过编排入口直接调用 L1 阶段。
- 下游阶段检测到快照缺失时，MUST 引导用户先走编排入口；NEVER 在无快照的情况下按空上下文静默执行。
- **高风险动作（部署 / 数据订正 / 破坏性命令）MUST 先取得用户显式 approval / confirm**，NEVER 自行下发。
- **每完成一个里程碑（功能可用 + 验证通过）MUST `git commit`**：提交前先跑 `pnpm typecheck` 与 `pnpm build` 确认通过，禁止把大量变更长期悬空在工作区。
- **环境降级 MUST 随交付提示**：探测到依赖缺失、安装跳过等环境差异时，MUST 在交付说明中列明并提示用户复验，NEVER 静默降级。
- 项目元数据见 `.pax/project-profile.json`（由 `pax-init` 生成）；本文件为同一份数据的人可读摘要。
- 本项目已安装 pax-family 全部 19 个 skill 于 `.pi/skills/`（清单见 `.pi/skills/.pax-skills-install.json`）。

---

## 项目概述

| 项 | 内容 |
|---|---|
| 项目名称 | PiForge Desktop |
| 项目描述 | 纯本地 AI 开发平台桌面客户端 |
| 仓库路径 | `C:\Users\sinvi\Documents\codes\PiForge` |
| 接入模式 | single_project（单项目） |
| 家族版本 | pax 0.2.0 |
| 安全敏感 | **是** — 持有加密凭据（`safeStorage` 存 API Key）并执行 LLM 生成的代码与 shell 命令（Sandbox 进程），改动此处需人工复核 |

---

## 技术栈

> 每一行都附**证据文件**。证据文件为空表示「未检测到」，NEVER 按猜测补全。

| 技术 | 版本 | 证据文件 |
|---|---|---|
| Electron | ^44.5.1 | `package.json` devDependencies |
| electron-vite | ^5.0.0 | `package.json`、`electron.vite.config.ts` |
| electron-builder | ^26.15.3 | `package.json`、`electron-builder.yml` |
| TypeScript | ^5.9.3 | `tsconfig.json`、`tsconfig.node.json`、`tsconfig.web.json` |
| React | ^19.3.0 | `package.json`（react / react-dom / @vitejs/plugin-react） |
| Vite | ^7.3.6 | `package.json`、`electron.vite.config.ts` |
| Tailwind CSS | ^4.3.3 | `package.json`（tailwindcss / @tailwindcss/vite） |
| shadcn/ui | — | `components.json`（+ cva / clsx / tailwind-merge / lucide-react） |
| zustand | ^5.0.15 | `package.json` dependencies |
| pi-agent SDK | ^1.0.2 | `package.json`（`@earendil-works/pi-coding-agent`） |
| pnpm | ^10（≥10） | `pnpm-lock.yaml` |
| CI/CD | GitHub Actions | `.github/workflows/build.yml` |

未检测到：Java / Maven、Gradle、Spring Boot、RuoYi、Vue、Element Plus、Ant Design、Pinia / Vuex、Go、Python、Docker。

> 说明：Electron / shadcn-ui / zustand 三行**不是** pax-init 扫描器自动产出的——其规则表尚未覆盖这三项，此行结论由 `package.json` 与 `components.json` 逐个核实得到。扫描器报出的其余项见 `.pax/project-profile.json`。

---

## 项目结构

```text
PiForge/
├─ src/
│  ├─ main/       Electron 主进程（窗口、Agent host、Sandbox host、凭据、trace）
│  ├─ preload/    contextBridge 白名单 API
│  ├─ agent/      pi-agent SDK 运行时（session、events、tools）
│  ├─ renderer/   React UI（Chat/ToolCall/Terminal/Editor/FileTree/Approval/...）
│  └─ shared/     IPC 类型与 Agent 事件类型
├─ eval/          评测
├─ resources/     打包资源
├─ scripts/       校验脚本（verify-agent-sdk.mjs / verify-tools.mjs）
├─ .pi/           Pi 本地配置与记忆（用户数据，已 gitignore）
│  └─ skills/     ← pax-family 19 个 skill 安装位置
└─ .pax/          pax-family 产物目录（本文件与 profile 的落点）
```

入口文件：`src/main/index.ts`、`src/preload/index.ts`、`src/renderer/main.tsx`、`src/renderer/App.tsx`。

---

## 编码规范

> 基于项目特征文件 + 用户确认。AI 写代码时 MUST 逐条遵循。

| 项 | 值 | 证据 |
|---|---|---|
| 语言 | TypeScript（`strict: true`、`target ES2022`、`module ESNext`、`moduleResolution Bundler`、`isolatedModules`、`noEmit`） | `tsconfig.json` |
| 框架 | Electron + electron-vite + React 19 + Vite 7 + Tailwind CSS 4 | `package.json` / `electron.vite.config.ts` |
| 分层模式 | **四层进程模型**：Renderer 只负责 UI，严禁直接访问 Node.js API；Main 管窗口/生命周期/凭据；Agent 在 Utility Process 跑 SDK；Sandbox 执行生成代码与 shell | `README.md`「四层进程模型」 |
| 类型边界 | 两套 tsconfig：`tsconfig.node.json`（main/preload/agent/shared）与 `tsconfig.web.json`（renderer/shared）。路径别名 `@renderer/*`、`@shared/*` 仅在 web 侧生效 | `tsconfig.node.json` / `tsconfig.web.json` |
| 安全检查 | 每个 BrowserWindow：`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`；API Key 用 Electron `safeStorage` 加密，**禁止 localStorage** | `README.md`「关键决策」 |
| linter | 未检测到（无 eslint 配置） | — |
| formatter | 未检测到（无 prettier / biome / .editorconfig） | — |

---

## 项目规范文档指针（唯一事实源）

**未检测到项目级规范文档**（无 `AGENTS.md`、无 `CONTRIBUTING.md`、无 `docs/adr/`、无 `CONTEXT.md`、无 `docs/agents/project-standards.md`）。

因此本文件当前是唯一的人可读协作规范；`README.md` 的「四层进程模型」「关键决策」两节被本文件引用为事实源：

- 事实源：`README.md`
- 消费规则：涉及进程分层与关键决策（模型 ID / 会话模式 / 配置目录 / 工具注册 / 安全配置 / API Key 存储）时，MUST 完整阅读 `README.md` 后逐条对照执行；冲突时**以 `README.md` 为准**。
- 若后续新增规范文档，应更新本条与 `.pax/project-profile.json` 的 `standards_doc`，而不是把原文复制进来。

---

## 通用编码行为规则（8 条 · 写码纪律）

> 与「编码规范」正交：编码规范管**本项目代码长什么样**，本节管 **AI 怎么克制地写**。

1. **兼容性**：改动旧接口、数据结构或行为前，先确认兼容要求。只有明确不需要兼容时，才移除旧路径；不要自行删除迁移或回退方案。
2. **最简实现**：选择能满足当前需求的最简单实现，别为尚未出现的需求增加抽象、配置和间接层。
3. **分层成长**：先做出能从头到尾跑通的最小版本，再逐步添加能力；不要为了尚未完成的复杂设计拆掉现有可用功能。
4. **职责分离**：保持组件职责清楚，相关代码放在合适的位置。
5. **优先成熟库**：成熟且维护良好的库能降低复杂度或提高可靠性时，优先使用；没有明确理由不要重写常见功能。
6. **先用已有依赖**：写新实现或加新依赖前，先检查项目已有依赖的文档、类型和现成能力，不要未经查证就假定它缺某个能力。
7. **长期架构**：做架构选择时考虑后续维护，不用明知很快要推倒的临时方案糊弄过去。
8. **先看先例**：设计方案前，先看成熟产品怎样解决同类问题；适合当前需求时，沿用已验证过的做法。

---

## 构建与验证命令

```bash
pnpm install          # 安装依赖（Node ≥ 20.19，pnpm ≥ 10）
pnpm dev              # 开发（electron-vite dev + Electron）
pnpm typecheck        # 类型检查 —— 本项目唯一的验证门，改代码后必须通过
pnpm build            # 构建产物
pnpm build:unpack     # 构建 + electron-builder --dir
pnpm dist:win         # 打包 Windows 安装包
```

| 项 | 状态 |
|---|---|
| build | `pnpm run build`（来自 `package.json` scripts） |
| test | **未检测到** —— 项目没有 test 脚本，不要凭空发明测试命令 |
| lint | **未检测到** —— 项目无 lint 脚本，也无 eslint / prettier 配置 |

> 未识别到的命令一律留空并标注「未检测到」，NEVER 编造命令。`pnpm typecheck` 是 README 明确要求的验证门（`typecheck:node` + `typecheck:web` 两段）。

---

## pax-family 产物目录

本项目的家族产物统一落在 `.pax/` 下：

| 子目录 | 用途 |
|---|---|
| `.pax/project-profile.json` | 机器可读项目元数据（本文件摘要的唯一来源） |
| `.pax/plan/` | 规划阶段产物 |
| `.pax/execute/` | 执行阶段产物 |
| `.pax/review/` | 评审阶段产物 |
| `.pax/docs/` | 文档沉淀产物 |

产物命名规则：`<问题类型>_<YYYYMMDD>_<HHMMSS>_<会话ID前8位>`。

> 注意：`.pax/` 目前**未**被 `.gitignore` 忽略（只有 `.pi/` 被忽略），因此这些产物会出现在 git 变更里。

---

## 贡献指南

本项目**暂无** `CONTRIBUTING.md`。在补上贡献指南之前，以本文件为协作约定的入口；提交规范沿用 Conventional Commits。

## 许可证

MIT（`package.json` 的 `license` 字段声明；仓库当前没有 `LICENSE` 文件）。
