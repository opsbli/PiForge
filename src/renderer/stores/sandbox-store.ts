import { create } from 'zustand'
import type { SandboxStatus } from '@shared/ipc-types'

interface SandboxState {
  status: SandboxStatus | null
  busy: boolean
  refresh: () => Promise<void>
  setMode: (mode: 'local' | 'docker') => Promise<void>
}

export const useSandboxStore = create<SandboxState>((set) => ({
  status: null,
  busy: false,

  refresh: async () => {
    try {
      set({ status: await window.piforge.getSandboxStatus() })
    } catch {
      // 忽略
    }
  },

  setMode: async (mode) => {
    set({ busy: true })
    try {
      const status = await window.piforge.setSandboxMode(mode)
      set({ status })
    } catch (err) {
      window.alert(`切换沙箱模式失败：${String(err)}`)
      set({ status: await window.piforge.getSandboxStatus() })
    } finally {
      set({ busy: false })
    }
  }
}))
