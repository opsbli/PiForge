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

  // 会话管理
  SESSION_LIST: 'session:list',
  SESSION_NEW: 'session:new',
  SESSION_SWITCH: 'session:switch',

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

  // 终端
  createTerminal(cwd?: string): Promise<string>
  sendTerminalInput(terminalId: string, data: string): Promise<void>
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void>
  killTerminal(terminalId: string): Promise<void>
  onTerminalData(cb: (event: TerminalDataEvent) => void): () => void
  onTerminalExit(cb: (event: TerminalExitEvent) => void): () => void

  // 自动更新
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
}
