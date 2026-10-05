import { create } from 'zustand'
import type {
  ResourcesSnapshot,
  SettingsScopeName,
  SettingsSnapshot,
  SettingsWriteResult,
  TrustSnapshot
} from '@shared/ipc-types'
import { readSettingsPath } from '@renderer/lib/settings-path'

/**
 * 设置中心状态。
 *
 * 三份只读快照来自 agent 进程；`draft` 是本地待写入的字段集合，
 * 只有点了保存并在确认对话框里确认后才会落盘。
 *
 * 确认门是 UI 层级的：它防误操作，不是安全边界（渲染进程与主进程均为本应用代码）。
 */
interface SettingsState {
  settings: SettingsSnapshot | null
  resources: ResourcesSnapshot | null
  trust: TrustSnapshot | null
  loading: boolean
  /** agent 尚未就绪（快照为 null） */
  unavailable: boolean
  error: string | null

  /** 写入目标 scope */
  scope: SettingsScopeName
  /** 待写入字段：key → 新值；null 表示删除该键（回到默认） */
  draft: Record<string, unknown>
  saving: boolean
  confirmOpen: boolean
  /** 最近一次成功写入的结果（用于提示需重载的字段） */
  lastWrite: SettingsWriteResult | null

  load: () => Promise<void>
  setScope: (scope: SettingsScopeName) => void
  /** 信任决定写入后更新快照 */
  setTrust: (trust: TrustSnapshot | null) => void
  setDraftValue: (key: string, value: unknown) => void
  resetDraft: () => void
  requestSave: () => void
  cancelSave: () => void
  confirmSave: () => Promise<void>
  reloadAgent: () => Promise<void>
  dismissResult: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  resources: null,
  trust: null,
  loading: false,
  unavailable: false,
  error: null,

  scope: 'global',
  draft: {},
  saving: false,
  confirmOpen: false,
  lastWrite: null,

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
  },

  setScope: (scope) => set({ scope }),

  setTrust: (trust) => set({ trust }),

  setDraftValue: (key, value) =>
    set((state) => {
      const draft = { ...state.draft }
      const current = readSettingsPath(state.settings?.effective, key) ?? null
      // 与当前显式值一致就不算改动，避免「改回原值」仍显示待保存
      if (JSON.stringify(current) === JSON.stringify(value ?? null)) delete draft[key]
      else draft[key] = value
      return { draft }
    }),

  resetDraft: () => set({ draft: {} }),

  requestSave: () => {
    if (Object.keys(get().draft).length === 0) return
    set({ confirmOpen: true, error: null })
  },

  cancelSave: () => set({ confirmOpen: false }),

  confirmSave: async () => {
    const { draft, scope } = get()
    const entries = Object.entries(draft).map(([key, value]) => ({ key, value }))
    if (entries.length === 0) {
      set({ confirmOpen: false })
      return
    }

    set({ saving: true, error: null })
    try {
      const result = await window.piforge.writeSettings({ scope, entries })
      if (!result) {
        set({ saving: false, confirmOpen: false, error: 'agent 未就绪，写入未执行' })
        return
      }
      if (!result.ok) {
        set({ saving: false, confirmOpen: false, error: result.error ?? '写入失败' })
        return
      }
      set({
        saving: false,
        confirmOpen: false,
        draft: {},
        lastWrite: result,
        settings: result.settings,
        resources: result.resources
      })
    } catch (err) {
      set({ saving: false, confirmOpen: false, error: String(err) })
    }
  },

  reloadAgent: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.piforge.reloadAgent()
      if (!result) {
        set({ loading: false, error: 'agent 未就绪，重载未执行' })
        return
      }
      if (!result.ok) {
        set({ loading: false, error: result.error ?? '重载失败', settings: result.settings })
        return
      }
      set({
        loading: false,
        settings: result.settings,
        resources: result.resources,
        lastWrite: null
      })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  dismissResult: () => set({ lastWrite: null })
}))
