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

  // 工作区
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_SELECT: 'workspace:select',

  // 文件系统
  FS_LIST: 'fs:list',
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
  SESSION_NEW: 'session:new',
  SESSION_SWITCH: 'session:switch',
  SESSION_MESSAGES: 'session:messages',

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

/** preload 暴露到 window.piforge 的白名单 API */
export interface PiForgeApi {
  // Agent
  sendPrompt(text: string): Promise<void>
  approveToolCall(callId: string): Promise<void>
  getSessionSummary(): Promise<SessionSummary>
  onAgentEvent(cb: (event: AgentEvent) => void): () => void
  listSessions(): Promise<SessionListItem[]>
  newSession(): Promise<void>
  switchSession(sessionPath: string): Promise<void>
  /** 读取当前会话活动分支的历史消息 */
  getSessionMessages(): Promise<SessionHistoryMessage[]>

  // 审批
  onApprovalRequest(cb: (request: ApprovalRequest) => void): () => void
  respondApproval(callId: string, approved: boolean): Promise<void>

  // 设置
  setApiKey(apiKey: string): Promise<void>
  getCredentialStatus(): Promise<CredentialStatus>

  // 工作区
  getWorkspace(): Promise<string | null>
  selectWorkspace(): Promise<string | null>

  // 文件系统
  listDir(dirPath: string): Promise<FileNode[]>
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
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
}
