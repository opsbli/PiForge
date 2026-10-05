import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type { SessionSummary } from '../../shared/ipc-types'
import type { AgentEvent } from '../../shared/agent-events'

/** 把一个 Agent 事件推给发起调用的渲染进程 */
function sendToRenderer(event: IpcMainInvokeEvent, payload: AgentEvent): void {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.webContents.send(IPC.AGENT_EVENT, payload)
}

/**
 * 阶段二：全部返回 mock 数据。
 * 阶段三会把这里替换为「转发给 Agent Utility Process」。
 */
export function registerAgentIpc(): void {
  ipcMain.handle(IPC.AGENT_PROMPT, async (event, text: unknown): Promise<void> => {
    const prompt = typeof text === 'string' ? text : String(text)
    sendToRenderer(event, { type: 'message_start', messageId: 'mock-1' })
    sendToRenderer(event, { type: 'message_delta', text: `(mock) 收到 prompt：${prompt}` })
    sendToRenderer(event, { type: 'message_end', messageId: 'mock-1' })
    sendToRenderer(event, { type: 'turn_end' })
  })

  ipcMain.handle(IPC.AGENT_APPROVE, async (_event, callId: unknown): Promise<void> => {
    console.log('[ipc] approveToolCall (mock):', callId)
  })

  ipcMain.handle(IPC.SESSION_SUMMARY, async (): Promise<SessionSummary> => {
    return {
      sessionId: 'mock-session',
      model: 'deepseek-flash',
      messageCount: 0,
      tokenUsage: { input: 0, output: 0 },
      cost: 0
    }
  })
}
