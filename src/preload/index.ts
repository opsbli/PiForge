import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-types'
import type { PiForgeApi } from '../shared/ipc-types'
import type { AgentEvent } from '../shared/agent-events'

/**
 * 只通过 contextBridge 暴露最小白名单 API。
 * 严禁暴露 ipcRenderer 原始对象，也不暴露任何 Node.js 能力。
 */
const api: PiForgeApi = {
  sendPrompt: (text: string): Promise<void> => ipcRenderer.invoke(IPC.AGENT_PROMPT, text),

  approveToolCall: (callId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.AGENT_APPROVE, callId),

  getSessionSummary: () => ipcRenderer.invoke(IPC.SESSION_SUMMARY),

  onAgentEvent: (cb: (event: AgentEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: AgentEvent): void => cb(payload)
    ipcRenderer.on(IPC.AGENT_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IPC.AGENT_EVENT, listener)
    }
  }
}

contextBridge.exposeInMainWorld('piforge', api)
