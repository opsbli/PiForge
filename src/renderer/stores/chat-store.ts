import { create } from 'zustand'
import type { AgentEvent } from '@shared/agent-events'
import type { SessionHistoryMessage } from '@shared/ipc-types'

export interface UserMessage {
  id: string
  role: 'user'
  text: string
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  text: string
  streaming: boolean
}

export interface ToolMessage {
  id: string
  role: 'tool'
  callId: string
  tool: string
  args: unknown
  status: 'running' | 'ok' | 'error'
  result?: unknown
  error?: string
}

export interface NoteMessage {
  id: string
  role: 'note'
  title: string
  text: string
}

export type ChatMessage = UserMessage | AssistantMessage | ToolMessage | NoteMessage

interface ChatState {
  messages: ChatMessage[]
  streaming: boolean
  /** 添加一条用户消息 */
  addUserMessage: (text: string) => void
  /** 把 Agent 事件归并进消息列表 */
  handleAgentEvent: (event: AgentEvent) => void
  /** 从 agent 侧读取当前会话历史并替换本地列表（切换/新建会话后调用） */
  loadHistory: () => Promise<void>
}

let seq = 0
const nextId = (prefix: string): string => `${prefix}-${++seq}`

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streaming: false,

  addUserMessage: (text) =>
    set((state) => ({
      messages: [...state.messages, { id: nextId('user'), role: 'user', text }]
    })),

  loadHistory: async () => {
    try {
      const history = await window.piforge.getSessionMessages()
      set({ messages: history.map(toChatMessage), streaming: false })
    } catch {
      // 读取失败时清空，避免残留上一个会话的消息造成误导
      set({ messages: [], streaming: false })
    }
  },

  handleAgentEvent: (event) =>
    set((state) => {
      const messages = [...state.messages]

      switch (event.type) {
        case 'message_start': {
          messages.push({
            id: event.messageId || nextId('assistant'),
            role: 'assistant',
            text: '',
            streaming: true
          })
          return { messages, streaming: true }
        }

        case 'message_delta': {
          // 追加到最后一条 assistant 消息
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]
            if (m.role === 'assistant') {
              messages[i] = { ...m, text: m.text + event.text, streaming: true }
              break
            }
          }
          return { messages, streaming: true }
        }

        case 'message_end': {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]
            if (m.role === 'assistant') {
              messages[i] = { ...m, streaming: false }
              break
            }
          }
          return { messages, streaming: false }
        }

        case 'tool_call_start': {
          messages.push({
            id: nextId('tool'),
            role: 'tool',
            callId: event.callId,
            tool: event.tool,
            args: event.args,
            status: 'running'
          })
          return { messages }
        }

        case 'tool_call_end': {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]
            if (m.role === 'tool' && m.callId === event.callId) {
              messages[i] = {
                ...m,
                status: event.ok ? 'ok' : 'error',
                result: event.result,
                error: event.error
              }
              break
            }
          }
          return { messages }
        }

        case 'turn_end':
          return { messages, streaming: false }

        case 'error':
          messages.push({
            id: nextId('error'),
            role: 'assistant',
            text: `[错误] ${event.message}`,
            streaming: false
          })
          return { messages, streaming: false }

        default:
          return { messages }
      }
    })
}))

/** 历史消息只缺 streaming 标记，其余字段与实时消息一致 */
function toChatMessage(message: SessionHistoryMessage): ChatMessage {
  if (message.role === 'assistant') {
    return { id: message.id, role: 'assistant', text: message.text, streaming: false }
  }
  return message
}