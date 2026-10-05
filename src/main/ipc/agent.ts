import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type { SessionSummary } from '../../shared/ipc-types'
import { agentHost } from '../agent-host'

/**
 * IPC 层：把渲染进程的调用转发给 Agent Utility Process。
 * 主进程本身不执行 Agent 逻辑。
 */
export function registerAgentIpc(): void {
  ipcMain.handle(IPC.AGENT_PROMPT, async (_event, text: unknown): Promise<void> => {
    const prompt = typeof text === 'string' ? text : String(text)
    agentHost.prompt(prompt)
  })

  ipcMain.handle(
    IPC.AGENT_APPROVE,
    async (_event, payload: unknown): Promise<void> => {
      const { callId, approved } = (payload ?? {}) as {
        callId?: string
        approved?: boolean
      }
      if (typeof callId === 'string') {
        agentHost.respondApproval(callId, approved !== false)
      }
    }
  )

  ipcMain.handle(IPC.APPROVAL_RESPONSE, async (_event, payload: unknown): Promise<void> => {
    const { callId, approved } = (payload ?? {}) as {
      callId?: string
      approved?: boolean
    }
    if (typeof callId === 'string') {
      agentHost.respondApproval(callId, approved === true)
    }
  })

  ipcMain.handle(IPC.SESSION_SUMMARY, async (): Promise<SessionSummary> => {
    return agentHost.getSummary()
  })

  ipcMain.handle(IPC.SESSION_LIST, async () => {
    return agentHost.listSessions()
  })

  ipcMain.handle(IPC.SESSION_LIST_ALL, async () => {
    return agentHost.listAllSessions()
  })

  ipcMain.handle(IPC.AGENT_WAIT_READY, async (): Promise<void> => {
    return agentHost.whenReady()
  })

  ipcMain.handle(IPC.SESSION_META, async () => agentHost.getSessionMeta())

  ipcMain.handle(IPC.MODEL_LIST, async () => agentHost.listModels())

  ipcMain.handle(IPC.SESSION_SET_THINKING, async (_event, level: unknown): Promise<void> => {
    if (typeof level === 'string' && level) agentHost.setThinkingLevel(level)
  })

  ipcMain.handle(
    IPC.SESSION_SET_MODEL,
    async (_event, request: { providerId?: string; modelId?: string } | undefined): Promise<void> => {
      const providerId = request?.providerId
      const modelId = request?.modelId
      if (typeof providerId === 'string' && typeof modelId === 'string') {
        agentHost.setModel(providerId, modelId)
      }
    }
  )

  ipcMain.handle(IPC.APPROVAL_SET_MODE, async (_event, mode: unknown): Promise<void> => {
    if (mode === 'auto' || mode === 'ask') agentHost.setApprovalMode(mode)
  })

  ipcMain.handle(IPC.SESSION_MESSAGES, async () => {
    return agentHost.getSessionMessages()
  })

  ipcMain.handle(IPC.TREE_GET, async () => {
    return agentHost.getTree()
  })

  ipcMain.handle(
    IPC.TREE_NAVIGATE,
    async (
      _event,
      payload: { targetId?: string; options?: { summarize?: boolean; customInstructions?: string; label?: string } }
    ) => {
      if (!payload?.targetId) return { tree: [], leafId: null }
      return agentHost.navigateTree(payload.targetId, payload.options ?? {})
    }
  )

  ipcMain.handle(IPC.SESSION_NEW, async (): Promise<void> => {
    agentHost.newSession()
  })

  ipcMain.handle(IPC.SESSION_SWITCH, async (_event, sessionPath: unknown): Promise<void> => {
    if (typeof sessionPath === 'string' && sessionPath) {
      agentHost.switchSession(sessionPath)
    }
  })

  ipcMain.handle(
    IPC.SESSION_RENAME,
    async (_event, payload: { path?: string; name?: string } | undefined): Promise<void> => {
      const path = payload?.path
      const name = payload?.name?.trim()
      if (typeof path === 'string' && path && name) {
        agentHost.renameSession(path, name)
      }
    }
  )

  ipcMain.handle(
    IPC.SESSION_DELETE,
    async (_event, payload: { path?: string } | undefined): Promise<void> => {
      if (typeof payload?.path === 'string' && payload.path) {
        agentHost.deleteSession(payload.path)
      }
    }
  )
}
