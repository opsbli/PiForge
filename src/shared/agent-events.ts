/**
 * Agent → UI 的事件类型（渲染进程通过 preload 的 onAgentEvent 订阅）。
 *
 * 阶段二只用到 message_delta / turn_end / error 三种（mock 数据）；
 * 阶段三接入 pi-agent SDK 后，会在 events.ts 里把这些事件与 SDK 的
 * AgentSessionEvent 做映射。
 */
export type AgentEvent =
  | { type: 'message_start'; messageId: string }
  | { type: 'message_delta'; text: string }
  | { type: 'message_end'; messageId: string }
  | {
      type: 'tool_call_start'
      callId: string
      tool: string
      args: unknown
    }
  | {
      type: 'tool_call_end'
      callId: string
      ok: boolean
      result?: unknown
      error?: string
    }
  | { type: 'turn_end' }
  | { type: 'error'; message: string }
