import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-types'
import type { PiForgeApi, ApprovalRequest } from '../shared/ipc-types'
import type { AgentEvent } from '../shared/agent-events'

/**
 * 只通过 contextBridge 暴露最小白名单 API。
 * 严禁暴露 ipcRenderer 原始对象，也不暴露任何 Node.js 能力。
 */
const api: PiForgeApi = {
  sendPrompt: (text: string): Promise<void> => ipcRenderer.invoke(IPC.AGENT_PROMPT, text),

  approveToolCall: (callId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.AGENT_APPROVE, { callId, approved: true }),

  getSessionSummary: () => ipcRenderer.invoke(IPC.SESSION_SUMMARY),

  onAgentEvent: (cb: (event: AgentEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: AgentEvent): void => cb(payload)
    ipcRenderer.on(IPC.AGENT_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IPC.AGENT_EVENT, listener)
    }
  },

  onApprovalRequest: (cb: (request: ApprovalRequest) => void): (() => void) => {
    const listener = (_event: unknown, payload: ApprovalRequest): void => cb(payload)
    ipcRenderer.on(IPC.APPROVAL_REQUEST, listener)
    return () => {
      ipcRenderer.removeListener(IPC.APPROVAL_REQUEST, listener)
    }
  },

  respondApproval: (callId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.APPROVAL_RESPONSE, { callId, approved })
}

contextBridge.exposeInMainWorld('piforge', api)
