import { create } from 'zustand'
import type { ResourcesSnapshot, SettingsSnapshot, TrustSnapshot } from '@shared/ipc-types'

/**
 * 设置中心的三份只读快照。
 *
 * 全部来自 agent 进程（设置与资源只能在那里读取：SDK 是 ESM 且需与运行中的
 * resourceLoader 共享同一份 SettingsManager）。agent 未就绪时三个快照均为 null，
 * 由 UI 展示未就绪状态，不伪造空数据。
 */
interface SettingsState {
  settings: SettingsSnapshot | null
  resources: ResourcesSnapshot | null
  trust: TrustSnapshot | null
  loading: boolean
  /** agent 尚未就绪（快照为 null） */
  unavailable: boolean
  error: string | null
  load: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  resources: null,
  trust: null,
  loading: false,
  unavailable: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const [settings, resources, trust] = await Promise.all([
        window.piforge.readSettings(),
        window.piforge.readResources(),
        window.piforge.readTrust()
      ])
      set({
        settings,
        resources,
        trust,
        unavailable: settings === null && resources === null,
        loading: false
      })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  }
}))
