import { create } from 'zustand'
import type { SessionSummary, SessionListItem } from '@shared/ipc-types'
import { useChatStore } from '@renderer/stores/chat-store'
import { useComposerStore } from '@renderer/stores/composer-store'

interface CostState {
  summary: SessionSummary | null
  sessions: SessionListItem[]
  /** 刷新当前会话的成本摘要 */
  refreshSummary: () => Promise<void>
  /** 刷新会话列表 */
  refreshSessions: () => Promise<void>
  /** 新建会话 */
  newSession: () => Promise<void>
  /** 切换会话 */
  switchSession: (sessionPath: string) => Promise<void>
}

export const useCostStore = create<CostState>((set, get) => ({
  summary: null,
  sessions: [],

  refreshSummary: async () => {
    try {
      set({ summary: await window.piforge.getSessionSummary() })
    } catch {
      // 忽略
    }
  },

  refreshSessions: async () => {
    try {
      set({ sessions: await window.piforge.listSessions() })
    } catch {
      set({ sessions: [] })
    }
  },

  newSession: async () => {
    await window.piforge.newSession()
    // 新建/切换会话后必须重载对话历史，否则界面会残留上一个会话的消息
    // （跨 store 调用集中在此，避免三个入口（侧栏/分组/快捷键）各自遗漏）
    await useChatStore.getState().loadHistory()
    await Promise.all([get().refreshSummary(), get().refreshSessions()])
    await useComposerStore.getState().refreshMeta()
  },

  switchSession: async (sessionPath) => {
    await window.piforge.switchSession(sessionPath)
    await useChatStore.getState().loadHistory()
    await Promise.all([get().refreshSummary(), get().refreshSessions()])
    await useComposerStore.getState().refreshMeta()
  }
}))
