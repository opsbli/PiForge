import type { AgentEvent } from './agent-events'

/** IPC 通道常量（main 与 preload 共用，避免字符串漂移） */
export const IPC = {
  /** renderer → main：发送用户 prompt */
  AGENT_PROMPT: 'agent:prompt',
  /** renderer → main：批准一次工具调用 */
  AGENT_APPROVE: 'agent:approve',
  /** renderer → main：读取当前会话摘要 */
  SESSION_SUMMARY: 'session:summary',
  /** main → renderer：Agent 事件流 */
  AGENT_EVENT: 'agent:event'
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
  }
  /** 估算费用（美元） */
  cost: number
}

/** preload 暴露到 window.piforge 的白名单 API */
export interface PiForgeApi {
  sendPrompt(text: string): Promise<void>
  approveToolCall(callId: string): Promise<void>
  getSessionSummary(): Promise<SessionSummary>
  onAgentEvent(cb: (event: AgentEvent) => void): () => void
}
