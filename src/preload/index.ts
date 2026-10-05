import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-types'
import type {
  PiForgeApi,
  ApprovalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  MemoryEntry
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
  newSession: (): Promise<void> => ipcRenderer.invoke(IPC.SESSION_NEW),
  switchSession: (sessionPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SESSION_SWITCH, sessionPath),

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

  // ---- 工作区 ----
  getWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_GET),
  selectWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_SELECT),

  // ---- 文件系统 ----
  listDir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_LIST, dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ, filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC.FS_WRITE, filePath, content),
  createEntry: (parentDir: string, name: string, isDirectory: boolean) =>
    ipcRenderer.invoke(IPC.FS_CREATE, parentDir, name, isDirectory),
  deleteEntry: (targetPath: string) => ipcRenderer.invoke(IPC.FS_DELETE, targetPath),

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
