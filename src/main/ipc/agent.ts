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
}
