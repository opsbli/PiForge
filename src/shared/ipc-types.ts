import type { AgentEvent } from './agent-events'

/** IPC 通道常量（main 与 preload 共用，避免字符串漂移） */
export const IPC = {
  // Agent
  AGENT_PROMPT: 'agent:prompt',
  AGENT_APPROVE: 'agent:approve',
  SESSION_SUMMARY: 'session:summary',
  AGENT_EVENT: 'agent:event',

  // 审批
  APPROVAL_REQUEST: 'approval:request',
  APPROVAL_RESPONSE: 'approval:response',

  // 设置
  SET_API_KEY: 'settings:set-api-key',
  CREDENTIAL_STATUS: 'settings:credential-status',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  SETTINGS_RELOAD: 'settings:reload',
  PACKAGES_LIST: 'packages:list',
  PACKAGES_INSTALL: 'packages:install',
  PACKAGES_REMOVE: 'packages:remove',
  PACKAGES_UPDATE: 'packages:update',
  PACKAGES_PROGRESS: 'packages:progress',
  MCP_LIST: 'mcp:list',
  MCP_UPSERT: 'mcp:upsert',
  MCP_REMOVE: 'mcp:remove',
  MCP_PATCH: 'mcp:patch',
  RESOURCES_READ: 'resources:read',
  TRUST_READ: 'trust:read',
  TRUST_SET: 'trust:set',
  UPDATER_STATUS: 'updater:status',
  APP_INFO: 'app:info',

  // 工作区
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_SELECT: 'workspace:select',

  // 项目（多项目管理）
  PROJECT_STATE: 'project:state',
  PROJECT_CREATE_FOLDER: 'project:create-folder',
  PROJECT_CREATE_BLANK: 'project:create-blank',
  PROJECT_RENAME: 'project:rename',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_ACTIVATE: 'project:activate',
  PROJECT_CHANGED: 'project:changed',
  AGENT_WAIT_READY: 'agent:wait-ready',

  // 本机个人资料（头像 / 昵称）
  PROFILE_GET: 'profile:get',
  PROFILE_SET_NICKNAME: 'profile:set-nickname',
  PROFILE_PICK_AVATAR: 'profile:pick-avatar',
  PROFILE_CLEAR_AVATAR: 'profile:clear-avatar',
  PROFILE_CHANGED: 'profile:changed',

  // 文件系统
  FS_LIST: 'fs:list',
  FS_SEARCH: 'fs:search',
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  FS_CREATE: 'fs:create',
  FS_DELETE: 'fs:delete',

  // 记忆管理
  MEMORY_LIST: 'memory:list',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_INDEX: 'memory:index',
  MEMORY_REBUILD: 'memory:rebuild',

  // 可观测性
  TRACE_LIST: 'trace:list',
  TRACE_SPANS: 'trace:spans',
  TRACE_STATS: 'trace:stats',

  // 沙箱
  SANDBOX_STATUS: 'sandbox:status',
  SANDBOX_DETECT: 'sandbox:detect',
  SANDBOX_SET_MODE: 'sandbox:set-mode',
  SANDBOX_STOP: 'sandbox:stop',

  // 会话树
  TREE_GET: 'tree:get',
  TREE_NAVIGATE: 'tree:navigate',

  // 会话管理
  SESSION_LIST: 'session:list',
  SESSION_LIST_ALL: 'session:list-all',
  SESSION_NEW: 'session:new',
  SESSION_SWITCH: 'session:switch',
  SESSION_MESSAGES: 'session:messages',

  // 会话控制（输入框工具栏）
  SESSION_META: 'session:meta',
  SESSION_SET_THINKING: 'session:set-thinking',
  SESSION_SET_MODEL: 'session:set-model',
  MODEL_LIST: 'model:list',
  APPROVAL_SET_MODE: 'approval:set-mode',

  // 附件选择（输入框工具栏）
  DIALOG_PICK_ATTACHMENTS: 'dialog:pick-attachments',

  // 自定义 provider / 模型（models.json）
  CUSTOM_PROVIDER_LIST: 'provider:list',
  CUSTOM_PROVIDER_SAVE: 'provider:save',
  CUSTOM_PROVIDER_DELETE: 'provider:delete',
  CUSTOM_PROVIDER_PROBE: 'provider:probe',
  CUSTOM_PROVIDER_FETCH_MODELS: 'provider:fetch-models',

  // 窗口控制（自定义标题栏）
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_MAXIMIZE_CHANGED: 'window:maximize-changed',

  // 终端
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

/** 会话摘要（CostDashboard / 状态栏使用） */
export interface SessionSummary {
  sessionId: string
  model: string
  messageCount: number
  tokenUsage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
  /** 估算费用（美元，由 SDK SessionStats 提供） */
  cost: number
}

/** 历史会话项（会话列表用） */
export interface SessionListItem {
  id: string
  path: string
  name?: string
  messageCount: number
  modified: string
  firstMessage: string
  /** 会话启动时的工作目录；用于跨项目分组。旧会话可能为空字符串 */
  cwd?: string
}

/**
 * 会话历史消息（回显用）。
 * 由 agent 进程按「根 → 当前 leaf」的活动分支重建，已过滤 system 与 thinking。
 * 字段形状与渲染进程的 ChatMessage 对齐，便于直接落进对话流。
 */
export type SessionHistoryMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string }
  | {
      id: string
      role: 'tool'
      callId: string
      tool: string
      args: unknown
      status: 'ok' | 'error'
      result?: unknown
      error?: string
    }
  // 分支摘要 / 上下文压缩摘要：不是对话消息，但属于当前上下文，单独标注展示
  | { id: string; role: 'note'; title: string; text: string }

/** 危险操作审批请求 */
export interface ApprovalRequest {
  callId: string
  tool: string
  command?: string
  detail: string
  reason: string
  rule?: string
}

/** 凭据状态 */
export interface CredentialStatus {
  hasStoredKey: boolean
  encryptionAvailable: boolean
  usingEnvVar: boolean
}

/** 文件树节点 */
export interface FileNode {
  name: string
  /** 绝对路径 */
  path: string
  /** 相对工作区的路径 */
  relativePath: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

/** 终端数据事件（main → renderer） */
export interface TerminalDataEvent {
  terminalId: string
  data: string
}

export interface TerminalExitEvent {
  terminalId: string
  exitCode: number
}

/** trace 记录 */
export interface TraceRow {
  id: string
  session_id: string
  started_at: number
  ended_at: number | null
  model: string
  status: string
  user_prompt: string
  input_tokens: number
  output_tokens: number
  cost: number
}

/** span 记录 */
export interface SpanRow {
  id: string
  trace_id: string
  type: 'user' | 'llm' | 'tool'
  name: string
  started_at: number
  duration_ms: number
  input: string
  output: string
  input_tokens: number
  output_tokens: number
  cost: number
  error: string | null
}

/** 可观测性汇总 */
export interface TraceStats {
  traceCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  toolCallCount: number
}

/** 沙箱状态 */
export interface SandboxDockerInfo {
  cliAvailable: boolean
  daemonRunning: boolean
  version?: string
  imageReady: boolean
  error?: string
}

export interface SandboxStatus {
  mode: 'local' | 'docker'
  docker: SandboxDockerInfo
  containerId?: string
}

/** 会话树节点（精简） */
export interface TreeEntry {
  id: string
  parentId: string | null
  type: string
  role?: string
  preview: string
  label?: string
  timestamp: string
  children: TreeEntry[]
}

/** 记忆条目 */
export interface MemoryEntry {
  name: string
  description: string
  type: 'decision' | 'preference' | 'fact' | 'debug_history'
  created: string
  modified: string
  body: string
}

/** 已配置的 Pi package */
export interface PackageInfo {
  source: string
  scope: 'user' | 'project'
  /** 对象形式且带资源过滤时为 true */
  filtered: boolean
  /** 已安装到的路径；未安装时为 null */
  installedPath: string | null
}

/** 安装 / 移除 / 更新过程中上报的进度 */
export interface PackageProgress {
  type: 'start' | 'progress' | 'complete' | 'error'
  action: 'install' | 'remove' | 'update' | 'clone' | 'pull'
  source: string
  message: string | null
}

export interface PackageActionRequest {
  source: string
  /** true 写入项目级配置，false 写入用户级 */
  local: boolean
}

export interface PackageResult {
  ok: boolean
  error?: string
  packages: PackageInfo[]
}

/* ---------------- MCP ---------------- */

export type McpTransportKind = 'stdio' | 'http'
export type McpExposureName = 'codemode' | 'deferred' | 'direct' | 'hidden'

export interface McpScopeNameRequest {
  scope: SettingsScopeName
  name: string
}

/**
 * MCP 服务器的可展示信息。
 *
 * 刻意**不包含 `env` / `headers` 的值**：它们常携带凭据，不回传到渲染进程，
 * 只回显键名。要修改变量值需要重新输入（写侧接受值，读侧不回显）。
 */
export interface McpServerView {
  name: string
  transport: McpTransportKind
  command: string | null
  args: string[]
  envKeys: string[]
  cwd: string | null
  url: string | null
  headerKeys: string[]
  timeout: number | null
  enabled: boolean
  exposure: McpExposureName
  description: string | null
  /** 定义该条目的文件：用户级或项目级 */
  source: SettingsScopeName
  sourcePath: string
  /** 项目级条目仅为「覆盖用户级服务器开关」形式时，指向被覆盖的服务器名 */
  overrideOf: string | null
  /** 配置校验失败时的原因（该条目会被 SDK 跳过） */
  error: string | null
}

export interface McpConfigView {
  servers: McpServerView[]
  autoEnableCodemode: boolean | null
  /** 读取 / 校验过程中发现的问题 */
  errors: string[]
  globalPath: string
  projectPath: string
  projectTrusted: boolean
  /** OAuth 令牌文件；与 CLI 共享，登录一次两边都能用 */
  authPath: string
  logPath: string
}

export interface McpServerInput {
  transport: McpTransportKind
  command?: string
  args?: string[]
  /** 提供时**整体替换** env；不提供则保持不变（避免误清空凭据） */
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  timeout?: number
  exposure?: McpExposureName
  description?: string
  enabled?: boolean
}

export interface McpUpsertRequest {
  scope: SettingsScopeName
  name: string
  config: McpServerInput
}

export interface McpPatchRequest {
  scope: SettingsScopeName
  name: string
  enabled?: boolean
  exposure?: McpExposureName
  autoEnableCodemode?: boolean
}

export interface McpConfigResult {
  ok: boolean
  error?: string
  config: McpConfigView | null
}

/** 应用与运行时版本（关于页） */
export interface AppInfo {
  appVersion: string
  electron: string
  chrome: string
  node: string
}

/* ------------------------------------------------------------------ *
 * 设置中心：只读快照类型
 * 这些类型跨 renderer / main / agent 三端共用，因此不引用 SDK 类型（用 string 兑宽）。
 * ------------------------------------------------------------------ */

export type ThinkingLevelName = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ProjectTrustDefault = 'ask' | 'always' | 'never'
export type TransportName = 'auto' | 'sse' | 'websocket' | 'websocket-cached'
export type CacheWarmingName = 'off' | 'streaming' | 'idle'
export type CodemodeModeName = 'on' | 'only'

/** 配置文件/目录的存在性与体积，被设置中心的多个分类复用 */
export interface FileProbe {
  path: string
  exists: boolean
  isDirectory: boolean
  /** 文件字节数；目录或不存在时为 null */
  bytes: number | null
}

/** 设置相关路径集合 */
export interface SettingsPaths {
  agentDir: string
  cwd: string
  globalSettings: string
  projectSettings: string
  globalMcp: string
  projectMcp: string
  trustFile: string
  authFile: string
}

/**
 * 解析后的**生效值**。
 *
 * 与 `global` / `project` 的区别：后者只包含显式写入的字段，
 * 这里是通过 SDK getter 得到的实际生效值（含内置默认）。
 * UI 必须把两者分开呈现，不能把生效值当成「已配置值」。
 */
export interface ResolvedSettings {
  // 模型
  defaultProvider: string | null
  defaultModel: string | null
  defaultThinkingLevel: ThinkingLevelName
  modelThinkingLevels: Record<string, ThinkingLevelName>
  enabledModels: string[] | null
  hideThinkingBlock: boolean
  cacheWarming: CacheWarmingName
  // 工具
  defaultTools: string[] | null
  codemodeMode: CodemodeModeName | null
  codemodeInlineBudget: number | null
  // 会话与上下文
  compactionEnabled: boolean
  compactionReserveTokens: number
  compactionKeepRecentTokens: number
  branchSummaryReserveTokens: number
  branchSummarySkipPrompt: boolean
  sessionDir: string | null
  transport: TransportName
  httpProxy: string | null
  httpIdleTimeoutMs: number
  retryEnabled: boolean
  retryMaxRetries: number
  retryBaseDelayMs: number
  steeringMode: 'all' | 'one-at-a-time'
  followUpMode: 'all' | 'one-at-a-time'
  // 资源
  packages: string[]
  extensionPaths: string[]
  skillPaths: string[]
  promptTemplatePaths: string[]
  themePaths: string[]
  enableSkillCommands: boolean
  // 信任
  defaultProjectTrust: ProjectTrustDefault
  // 其他
  shellPath: string | null
  shellCommandPrefix: string | null
  npmCommand: string[] | null
  enableInstallTelemetry: boolean
  enableAnalytics: boolean
  imageAutoResize: boolean
  blockImages: boolean
}

/** 设置写入的 scope */
export type SettingsScopeName = 'global' | 'project'

/** 字段取值类型 */
export type SettingsValueKind = 'boolean' | 'number' | 'string' | 'stringArray' | 'enum'

/**
 * 字段规格：**由 agent 侧作为唯一权威**，渲染进程据此生成控件、
 * 禁用不支持的 scope、并判断是否需要重载。
 * 两端各写一份字段表必然漂移，因此这里共享同一份。
 */
export interface SettingsFieldSpec {
  /** 点分路径键，如 `compaction.enabled` */
  key: string
  kind: SettingsValueKind
  /** 允许写入的 scope（例如 cacheWarming 只允许 global） */
  scopes: SettingsScopeName[]
  /** enum 的允许取值 */
  options?: string[]
  min?: number
  max?: number
  /** true 表示写入后必须重载 agent 才生效 */
  needsReload: boolean
  /**
   * SDK 内置默认值；用于展示「生效值」与判断当前是否偏离默认。
   * 平台相关的默认值（sessionDir / shellPath 等）一律省略，避免编造。
   */
  defaultValue?: unknown
}

export interface SettingsPatchEntry {
  key: string
  value: unknown
}

export interface SettingsWriteRequest {
  scope: SettingsScopeName
  entries: SettingsPatchEntry[]
}

export interface SettingsWriteResult {
  ok: boolean
  error?: string
  /** 实际写入的文件路径 */
  target?: string
  /** 已写入且在运行中立即生效的字段 */
  appliedLive: string[]
  /** 已写入但仍需重载才生效的字段 */
  needsReload: string[]
  settings: SettingsSnapshot | null
  resources: ResourcesSnapshot | null
}

export interface SettingsReloadResult {
  ok: boolean
  error?: string
  settings: SettingsSnapshot | null
  resources: ResourcesSnapshot | null
}

/** 设置只读快照 */
export interface SettingsSnapshot {
  paths: SettingsPaths
  /** 依赖版本（SDK 版本由 agent 进程上报） */
  versions: { sdk: string | null }
  /** 全局 settings.json 的显式字段 */
  global: Record<string, unknown>
  /** 项目 .pi/settings.json 的显式字段 */
  project: Record<string, unknown>
  /** 合并后的显式字段（全局 + 项目覆盖） */
  effective: Record<string, unknown>
  resolved: ResolvedSettings
  projectTrusted: boolean
  /** 读取过程中遇到的错误（文件损坏等） */
  errors: Array<{ scope: 'global' | 'project'; message: string }>
  files: FileProbe[]
  /** 字段规格（写入能力的唯一权威） */
  fields: SettingsFieldSpec[]
  /**
   * 按字段规格键组织的**生效值**（显式配置优先，否则取 spec 的 defaultValue）。
   * 与 `effective` 的区别：后者只含显式写入的字段。
   */
  resolvedValues: Record<string, unknown>
}

/** 资源加载诊断 */
export interface ResourceDiagnosticInfo {
  path: string
  message: string
  severity: 'error' | 'warning'
}

export interface ExtensionInfo {
  /** 展示名：文件取 basename，内置取 builtin:<name> */
  name: string
  path: string
  /** 来源标签，来自 SourceInfo.source */
  source: string
  scope: string
  builtin: boolean
  toolCount: number
  commandCount: number
}

export interface SkillInfo {
  name: string
  description: string
  filePath: string
  baseDir: string
  source: string
  scope: string
  /** true 表示只能由用户显式调用，不进入模型提示 */
  disableModelInvocation: boolean
}

/** 已注册工具的简要信息 */
export interface ToolInfoLite {
  name: string
  description: string
  /** 归属：内置 / MCP / 扩展 */
  origin: 'builtin' | 'mcp' | 'extension'
  /** MCP 服务器名（origin 为 mcp 时） */
  server: string | null
  exposure: string
  /** 当前是否处于激活（会向模型声明）状态 */
  active: boolean
}

/** 已加载资源只读快照 */
export interface ResourcesSnapshot {
  extensions: ExtensionInfo[]
  extensionDiagnostics: ResourceDiagnosticInfo[]
  skills: SkillInfo[]
  skillDiagnostics: ResourceDiagnosticInfo[]
  /** prompt 模板与主题属于 TUI 概念，GUI 只统计数量 */
  counts: { skills: number; prompts: number; themes: number }
  /** 已加载的上下文文件（AGENTS.md 等） */
  contextFiles: Array<{ path: string; bytes: number }>
  systemPromptSource: string | null
  appendSystemPromptSources: string[]
  /** 已注册工具（含未激活的） */
  tools: ToolInfoLite[]
}

/** 项目信任只读快照 */
export interface TrustSnapshot {
  cwd: string
  /** 已保存的决定；null 表示无保存记录 */
  decision: boolean | null
  /** 保存该决定的 trust.json 路径 */
  savedPath: string | null
  /** 是否探测到受保护的项目资源（决定是否需要信任） */
  requiresTrust: boolean
  /** 探测到的受保护项目资源 */
  protectedResources: string[]
  /** 当前运行中的 loader 是否按已信任加载 */
  loaderTrusted: boolean
  defaultProjectTrust: ProjectTrustDefault
}

/** decision 为 null 表示清除已保存的决定 */
export interface TrustWriteRequest {
  decision: boolean | null
}

export interface TrustWriteResult {
  ok: boolean
  error?: string
  trust: TrustSnapshot | null
  /** 生效时机说明（清除决定与写入决定的语义不同） */
  note?: string
}

/** 自动更新状态（由主进程广播） */
export interface UpdaterStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  version?: string
  percent?: number
  message?: string
}

/**
 * 项目类型。
 * - `local`：从本地文件夹创建，`path` 指向用户目录，删除项目只移除登记、不动文件。
 * - `blank`：应用管理的空白项目，目录位于 userData 下，删除时一并清理。
 */
export type ProjectKind = 'local' | 'blank'

/** 一个已登记的项目 */
export interface ProjectRecord {
  id: string
  /** 展示名，可重命名（不改变磁盘目录名） */
  name: string
  /** 工作目录绝对路径 */
  path: string
  kind: ProjectKind
  createdAt: string
  lastOpenedAt: string
}

/** 项目列表状态（主进程为唯一事实来源） */
export interface ProjectState {
  projects: ProjectRecord[]
  activeProjectId: string | null
}

export interface ProjectCreateBlankRequest {
  name?: string
}

export interface ProjectRenameRequest {
  id: string
  name: string
}

export interface ProjectIdRequest {
  id: string
}

/** 本机个人资料（头像 / 昵称）；属于界面身份，不入 agent 配置 */
export interface UserProfile {
  /** 已设置的昵称；未设置为 null */
  nickname: string | null
  /** 头像 data URL；未设置为 null */
  avatarDataUrl: string | null
  /** 未设置昵称时用于展示的默认昵称（系统用户名，回退「未命名用户」） */
  defaultNickname: string
}

export interface ProfileNicknameRequest {
  nickname: string
}

/** 审批模式：auto = 完全自动放行，ask = 危险操作弹窗 */
export type ApprovalMode = 'auto' | 'ask'

/** 模型清单项（输入框模型选择器） */
export interface ModelListItem {
  providerId: string
  /** provider 展示名（内置名称或自定义配置的 name），用于选择器分组标题 */
  providerName: string
  id: string
  name: string
  reasoning: boolean
}

/** 上下文用量（对齐 SDK ContextUsage） */
export interface ContextUsageView {
  tokens: number | null
  contextWindow: number
  percent: number | null
}

/** 当前会话的模型 / 思考档位 / 上下文用量 */
export interface SessionMeta {
  providerId: string
  modelId: string
  thinkingLevel: string
  availableThinkingLevels: string[]
  contextUsage: ContextUsageView | null
}

/** 自定义模型条目（一条 provider 下可启用多个模型） */
export interface CustomModelEntry {
  id: string
  name?: string
  enabled: boolean
}

/** 自定义 provider 配置（不回传密钥本身，只回传是否已存） */
export interface CustomProvider {
  /** 写入 models.json 的 provider id */
  id: string
  name: string
  /** 供应商类型：SDK 内置 provider id，用于预填 baseUrl / api */
  templateProviderId: string | null
  baseUrl: string
  api: string
  /** 关闭后该 provider 的模型不会出现在模型选择器 */
  enabled: boolean
  models: CustomModelEntry[]
  hasApiKey: boolean
}

/** 保存自定义 provider；apiKey 为 null/省略时保留已存密钥，空字符串表示不设置 */
export interface SaveProviderRequest {
  /** 编辑时的原 provider id；新建时省略，由名称自动派生 */
  id?: string
  provider: Omit<CustomProvider, 'hasApiKey' | 'id'>
  apiKey?: string | null
}

/** 供应商探测（测试连接 / 获取模型）结果 */
export interface ProviderProbeResult {
  ok: boolean
  error?: string
  models: Array<{ id: string; name?: string }>
}

/** 探测请求；apiKey 省略时用该 provider 已存的密钥 */
export interface ProviderProbeRequest {
  providerId?: string
  baseUrl: string
  api: string
  apiKey?: string
}

/** preload 暴露到 window.piforge 的白名单 API */
export interface PiForgeApi {
  // Agent
  sendPrompt(text: string): Promise<void>
  approveToolCall(callId: string): Promise<void>
  getSessionSummary(): Promise<SessionSummary>
  onAgentEvent(cb: (event: AgentEvent) => void): () => void
  listSessions(): Promise<SessionListItem[]>
  /** 跨项目列出全部历史会话（按 cwd 分组用） */
  listAllSessions(): Promise<SessionListItem[]>
  newSession(): Promise<void>
  switchSession(sessionPath: string): Promise<void>
  /** 读取当前会话活动分支的历史消息 */
  getSessionMessages(): Promise<SessionHistoryMessage[]>
  /** 等待 agent 进程就绪（重启工作区后使用） */
  waitAgentReady(): Promise<void>

  // 会话控制（输入框工具栏）
  getSessionMeta(): Promise<SessionMeta>
  setThinkingLevel(level: string): Promise<void>
  setModel(request: { providerId: string; modelId: string }): Promise<void>
  listModels(): Promise<{
    models: ModelListItem[]
    current: { providerId: string; modelId: string }
  }>
  setApprovalMode(mode: ApprovalMode): Promise<void>
  /** 选择要附加的文件或文件夹（返回绝对路径；取消返回空数组） */
  pickAttachments(kind: 'file' | 'folder'): Promise<string[]>

  // 自定义 provider / 模型（写入 agent 目录 models.json）
  listCustomProviders(): Promise<CustomProvider[]>
  saveCustomProvider(request: SaveProviderRequest): Promise<CustomProvider[]>
  deleteCustomProvider(id: string): Promise<CustomProvider[]>
  probeProvider(request: ProviderProbeRequest): Promise<ProviderProbeResult>
  fetchProviderModels(request: ProviderProbeRequest): Promise<ProviderProbeResult>

  // 审批
  onApprovalRequest(cb: (request: ApprovalRequest) => void): () => void
  respondApproval(callId: string, approved: boolean): Promise<void>

  // 设置
  setApiKey(apiKey: string): Promise<void>
  getCredentialStatus(): Promise<CredentialStatus>
  /** 读取设置、资源与信任的只读快照（设置中心用） */
  readSettings(): Promise<SettingsSnapshot | null>
  /** 写入设置（需先取得用户确认；渲染进程负责确认门） */
  writeSettings(request: SettingsWriteRequest): Promise<SettingsWriteResult>
  /** 重载 agent：重读配置 + 重载资源 + 重建工具集 */
  reloadAgent(): Promise<SettingsReloadResult>
  listPackages(): Promise<PackageResult>
  /** 安装 Pi package（会执行 npm / git，需先取得用户确认） */
  installPackage(request: PackageActionRequest): Promise<PackageResult>
  /** 移除 Pi package */
  removePackage(request: PackageActionRequest): Promise<PackageResult>
  /** 更新一个或全部 Pi packages */
  updatePackages(request: { source?: string }): Promise<PackageResult>
  onPackagesProgress(cb: (progress: PackageProgress) => void): () => void
  readMcpConfig(): Promise<McpConfigResult | null>
  /** 新增或整体替换一个 MCP 服务器（需先取得用户确认） */
  upsertMcpServer(request: McpUpsertRequest): Promise<McpConfigResult>
  /** 删除一个 MCP 服务器（需先取得用户确认） */
  removeMcpServer(request: McpScopeNameRequest): Promise<McpConfigResult>
  /** 只改 enabled / exposure / autoEnableCodemode */
  patchMcpServer(request: McpPatchRequest): Promise<McpConfigResult>
  readResources(): Promise<ResourcesSnapshot | null>
  readTrust(): Promise<TrustSnapshot | null>
  /** 写入 / 清除项目信任决定（需先取得用户确认） */
  writeTrust(request: TrustWriteRequest): Promise<TrustWriteResult | null>
  /** 订阅自动更新状态 */
  onUpdaterStatus(cb: (status: UpdaterStatus) => void): () => void
  /** 应用与运行时的版本信息（关于页） */
  getAppInfo(): Promise<AppInfo>

  // 工作区
  getWorkspace(): Promise<string | null>
  selectWorkspace(): Promise<string | null>

  // 项目（多项目管理）
  getProjectState(): Promise<ProjectState>
  /** 弹出文件夹选择框创建本地项目；取消返回 null */
  createProjectFromFolder(): Promise<ProjectState | null>
  createBlankProject(request?: ProjectCreateBlankRequest): Promise<ProjectState>
  renameProject(request: ProjectRenameRequest): Promise<ProjectState>
  /** 删除项目登记（本地项目不动磁盘文件，空白项目清理其目录） */
  removeProject(request: ProjectIdRequest): Promise<ProjectState>
  activateProject(request: ProjectIdRequest): Promise<ProjectState>
  /** 项目列表变化（主进程广播） */
  onProjectChanged(cb: (state: ProjectState) => void): () => void

  // 本机个人资料（头像 / 昵称）
  getProfile(): Promise<UserProfile>
  setNickname(request: ProfileNicknameRequest): Promise<UserProfile>
  /** 弹出图片选择框设置头像；取消返回 null */
  pickAvatar(): Promise<UserProfile | null>
  clearAvatar(): Promise<UserProfile>
  /** 个人资料变化（主进程广播） */
  onProfileChanged(cb: (profile: UserProfile) => void): () => void

  // 文件系统
  listDir(dirPath: string): Promise<FileNode[]>
  /** 在当前工作区内按名称/路径模糊搜索（限深限数），用于 @ 引用文件 */
  searchFiles(query: string, limit?: number): Promise<FileNode[]>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<void>
  createEntry(parentDir: string, name: string, isDirectory: boolean): Promise<FileNode>
  deleteEntry(targetPath: string): Promise<void>

  // 窗口控制（自定义标题栏）
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<boolean>
  closeWindow(): Promise<void>
  isWindowMaximized(): Promise<boolean>
  onWindowMaximizedChange(cb: (maximized: boolean) => void): () => void

  // 终端
  createTerminal(cwd?: string): Promise<string>
  sendTerminalInput(terminalId: string, data: string): Promise<void>
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void>
  killTerminal(terminalId: string): Promise<void>
  onTerminalData(cb: (event: TerminalDataEvent) => void): () => void
  onTerminalExit(cb: (event: TerminalExitEvent) => void): () => void

  // 可观测性
  listTraces(limit?: number): Promise<TraceRow[]>
  listSpans(traceId: string): Promise<SpanRow[]>
  getTraceStats(): Promise<TraceStats>

  // 沙箱
  getSandboxStatus(): Promise<SandboxStatus>
  detectDocker(): Promise<SandboxDockerInfo>
  setSandboxMode(mode: 'local' | 'docker'): Promise<SandboxStatus>
  stopSandbox(): Promise<SandboxStatus>

  // 会话树
  getTree(): Promise<{ tree: TreeEntry[]; leafId: string | null }>
  navigateTree(
    targetId: string,
    options: { summarize?: boolean; customInstructions?: string; label?: string }
  ): Promise<{ tree: TreeEntry[]; leafId: string | null }>

  // 记忆管理
  listMemories(): Promise<MemoryEntry[]>
  readMemory(name: string): Promise<MemoryEntry | null>
  writeMemory(entry: {
    name: string
    description: string
    type: string
    body: string
  }): Promise<MemoryEntry>
  deleteMemory(name: string): Promise<void>
  getMemoryIndex(): Promise<string>

  // 自动更新
  checkForUpdates(): Promise<UpdaterStatus>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
}
