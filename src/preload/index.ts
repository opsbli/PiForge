import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-types'
import type {
  PiForgeApi,
  ApprovalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  MemoryEntry,
  PackageProgress,
  ProjectState,
  UserProfile,
  UpdaterStatus
} from '../shared/ipc-types'
import type { AgentEvent } from '../shared/agent-events'

/**
 * 只通过 contextBridge 暴露最小白名单 API。
 * 严禁暴露 ipcRenderer 原始对象，也不暴露任何 Node.js 能力。
 */
const api: PiForgeApi = {
  // ---- Agent ----
  sendPrompt: (text: string): Promise<void> => ipcRenderer.invoke(IPC.AGENT_PROMPT, text),

  approveToolCall: (callId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.AGENT_APPROVE, { callId, approved: true }),

  getSessionSummary: () => ipcRenderer.invoke(IPC.SESSION_SUMMARY),

  listSessions: () => ipcRenderer.invoke(IPC.SESSION_LIST),
  listAllSessions: () => ipcRenderer.invoke(IPC.SESSION_LIST_ALL),
  newSession: (): Promise<void> => ipcRenderer.invoke(IPC.SESSION_NEW),
  switchSession: (sessionPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SESSION_SWITCH, sessionPath),

  getSessionMessages: () => ipcRenderer.invoke(IPC.SESSION_MESSAGES),

  waitAgentReady: (): Promise<void> => ipcRenderer.invoke(IPC.AGENT_WAIT_READY),

  // ---- 会话控制（输入框工具栏）----
  getSessionMeta: () => ipcRenderer.invoke(IPC.SESSION_META),
  setThinkingLevel: (level: string) => ipcRenderer.invoke(IPC.SESSION_SET_THINKING, level),
  setModel: (request) => ipcRenderer.invoke(IPC.SESSION_SET_MODEL, request),
  listModels: () => ipcRenderer.invoke(IPC.MODEL_LIST),
  setApprovalMode: (mode) => ipcRenderer.invoke(IPC.APPROVAL_SET_MODE, mode),
  pickAttachments: (kind) => ipcRenderer.invoke(IPC.DIALOG_PICK_ATTACHMENTS, kind),

  // ---- 自定义 provider / 模型 ----
  listCustomProviders: () => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_LIST),
  saveCustomProvider: (request) => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_SAVE, request),
  deleteCustomProvider: (id: string) => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_DELETE, id),
  listProviderTemplates: () => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_TEMPLATES),
  probeProvider: (request) => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_PROBE, request),
  fetchProviderModels: (request) => ipcRenderer.invoke(IPC.CUSTOM_PROVIDER_FETCH_MODELS, request),

  onAgentEvent: (cb: (event: AgentEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: AgentEvent): void => cb(payload)
    ipcRenderer.on(IPC.AGENT_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IPC.AGENT_EVENT, listener)
    }
  },

  // ---- 审批 ----
  onApprovalRequest: (cb: (request: ApprovalRequest) => void): (() => void) => {
    const listener = (_event: unknown, payload: ApprovalRequest): void => cb(payload)
    ipcRenderer.on(IPC.APPROVAL_REQUEST, listener)
    return () => {
      ipcRenderer.removeListener(IPC.APPROVAL_REQUEST, listener)
    }
  },

  respondApproval: (callId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.APPROVAL_RESPONSE, { callId, approved }),

  // ---- 设置 ----
  setApiKey: (apiKey: string): Promise<void> => ipcRenderer.invoke(IPC.SET_API_KEY, apiKey),

  getCredentialStatus: () => ipcRenderer.invoke(IPC.CREDENTIAL_STATUS),

  readSettings: () => ipcRenderer.invoke(IPC.SETTINGS_READ),

  writeSettings: (request) => ipcRenderer.invoke(IPC.SETTINGS_WRITE, request),

  reloadAgent: () => ipcRenderer.invoke(IPC.SETTINGS_RELOAD),

  listPackages: () => ipcRenderer.invoke(IPC.PACKAGES_LIST),

  installPackage: (request) => ipcRenderer.invoke(IPC.PACKAGES_INSTALL, request),

  removePackage: (request) => ipcRenderer.invoke(IPC.PACKAGES_REMOVE, request),

  updatePackages: (request) => ipcRenderer.invoke(IPC.PACKAGES_UPDATE, request),

  onPackagesProgress: (cb: (progress: PackageProgress) => void): (() => void) => {
    const listener = (_event: unknown, payload: PackageProgress): void => cb(payload)
    ipcRenderer.on(IPC.PACKAGES_PROGRESS, listener)
    return () => {
      ipcRenderer.removeListener(IPC.PACKAGES_PROGRESS, listener)
    }
  },

  readMcpConfig: () => ipcRenderer.invoke(IPC.MCP_LIST),

  upsertMcpServer: (request) => ipcRenderer.invoke(IPC.MCP_UPSERT, request),

  removeMcpServer: (request) => ipcRenderer.invoke(IPC.MCP_REMOVE, request),

  patchMcpServer: (request) => ipcRenderer.invoke(IPC.MCP_PATCH, request),
  readResources: () => ipcRenderer.invoke(IPC.RESOURCES_READ),
  readTrust: () => ipcRenderer.invoke(IPC.TRUST_READ),

  writeTrust: (request) => ipcRenderer.invoke(IPC.TRUST_SET, request),

  onUpdaterStatus: (cb: (status: UpdaterStatus) => void): (() => void) => {
    const listener = (_event: unknown, payload: UpdaterStatus): void => cb(payload)
    ipcRenderer.on(IPC.UPDATER_STATUS, listener)
    return () => {
      ipcRenderer.removeListener(IPC.UPDATER_STATUS, listener)
    }
  },
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_INFO),

  // ---- 工作区 ----
  getWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_GET),
  selectWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_SELECT),

  // ---- 项目（多项目管理） ----
  getProjectState: () => ipcRenderer.invoke(IPC.PROJECT_STATE),
  createProjectFromFolder: () => ipcRenderer.invoke(IPC.PROJECT_CREATE_FOLDER),
  createBlankProject: (request) => ipcRenderer.invoke(IPC.PROJECT_CREATE_BLANK, request),
  renameProject: (request) => ipcRenderer.invoke(IPC.PROJECT_RENAME, request),
  removeProject: (request) => ipcRenderer.invoke(IPC.PROJECT_REMOVE, request),
  activateProject: (request) => ipcRenderer.invoke(IPC.PROJECT_ACTIVATE, request),
  onProjectChanged: (cb) => {
    const listener = (_event: unknown, payload: ProjectState): void => cb(payload)
    ipcRenderer.on(IPC.PROJECT_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC.PROJECT_CHANGED, listener)
    }
  },

  // ---- 本机个人资料（头像 / 昵称） ----
  getProfile: () => ipcRenderer.invoke(IPC.PROFILE_GET),
  setNickname: (request) => ipcRenderer.invoke(IPC.PROFILE_SET_NICKNAME, request),
  pickAvatar: () => ipcRenderer.invoke(IPC.PROFILE_PICK_AVATAR),
  clearAvatar: () => ipcRenderer.invoke(IPC.PROFILE_CLEAR_AVATAR),
  onProfileChanged: (cb) => {
    const listener = (_event: unknown, payload: UserProfile): void => cb(payload)
    ipcRenderer.on(IPC.PROFILE_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC.PROFILE_CHANGED, listener)
    }
  },

  // ---- 文件系统 ----
  listDir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_LIST, dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ, filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC.FS_WRITE, filePath, content),
  createEntry: (parentDir: string, name: string, isDirectory: boolean) =>
    ipcRenderer.invoke(IPC.FS_CREATE, parentDir, name, isDirectory),
  deleteEntry: (targetPath: string) => ipcRenderer.invoke(IPC.FS_DELETE, targetPath),

  // ---- 窗口控制（自定义标题栏）----
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),

  toggleMaximizeWindow: (): Promise<boolean> => ipcRenderer.invoke(IPC.WINDOW_TOGGLE_MAXIMIZE),

  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_CLOSE),

  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),

  onWindowMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: unknown, payload: boolean): void => cb(payload)
    ipcRenderer.on(IPC.WINDOW_MAXIMIZE_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZE_CHANGED, listener)
    }
  },

  // ---- 终端 ----
  createTerminal: (cwd?: string) => ipcRenderer.invoke(IPC.TERMINAL_CREATE, cwd),
  sendTerminalInput: (terminalId: string, data: string) =>
    ipcRenderer.invoke(IPC.TERMINAL_INPUT, terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.TERMINAL_RESIZE, terminalId, cols, rows),
  killTerminal: (terminalId: string) => ipcRenderer.invoke(IPC.TERMINAL_KILL, terminalId),
  onTerminalData: (cb: (event: TerminalDataEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: TerminalDataEvent): void => cb(payload)
    ipcRenderer.on(IPC.TERMINAL_DATA, listener)
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_DATA, listener)
    }
  },
  onTerminalExit: (cb: (event: TerminalExitEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: TerminalExitEvent): void => cb(payload)
    ipcRenderer.on(IPC.TERMINAL_EXIT, listener)
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_EXIT, listener)
    }
  },

  // ---- 可观测性 ----
  listTraces: (limit?: number) => ipcRenderer.invoke(IPC.TRACE_LIST, limit),
  listSpans: (traceId: string) => ipcRenderer.invoke(IPC.TRACE_SPANS, traceId),
  getTraceStats: () => ipcRenderer.invoke(IPC.TRACE_STATS),

  // ---- 沙箱 ----
  getSandboxStatus: () => ipcRenderer.invoke(IPC.SANDBOX_STATUS),
  detectDocker: () => ipcRenderer.invoke(IPC.SANDBOX_DETECT),
  setSandboxMode: (mode: 'local' | 'docker') => ipcRenderer.invoke(IPC.SANDBOX_SET_MODE, mode),
  stopSandbox: () => ipcRenderer.invoke(IPC.SANDBOX_STOP),

  // ---- 会话树 ----
  getTree: () => ipcRenderer.invoke(IPC.TREE_GET),
  navigateTree: (targetId: string, options) =>
    ipcRenderer.invoke(IPC.TREE_NAVIGATE, { targetId, options }),

  // ---- 记忆管理 ----
  listMemories: () => ipcRenderer.invoke(IPC.MEMORY_LIST),
  readMemory: (name: string) => ipcRenderer.invoke(IPC.MEMORY_READ, name),
  writeMemory: (entry: { name: string; description: string; type: string; body: string }) => ipcRenderer.invoke(IPC.MEMORY_WRITE, entry),
  deleteMemory: (name: string) => ipcRenderer.invoke(IPC.MEMORY_DELETE, name),
  getMemoryIndex: () => ipcRenderer.invoke(IPC.MEMORY_INDEX),

  // ---- 自动更新 ----
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updater:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install')
}

contextBridge.exposeInMainWorld('piforge', api)
