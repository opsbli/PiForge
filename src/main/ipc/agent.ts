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

  ipcMain.handle(IPC.AGENT_APPROVE, async (_event, callId: unknown): Promise<void> => {
    // 阶段五接入 ApprovalDialog 后再实现真正的审批回传
    console.log('[ipc] approveToolCall:', callId)
  })

  ipcMain.handle(IPC.SESSION_SUMMARY, async (): Promise<SessionSummary> => {
    return agentHost.getSummary()
  })
}
