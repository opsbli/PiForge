import { create } from 'zustand'
import type { SessionSummary, SessionListItem } from '@shared/ipc-types'

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
    await Promise.all([get().refreshSummary(), get().refreshSessions()])
  },

  switchSession: async (sessionPath) => {
    await window.piforge.switchSession(sessionPath)
    await Promise.all([get().refreshSummary(), get().refreshSessions()])
  }
}))
