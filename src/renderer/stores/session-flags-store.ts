import { create } from 'zustand'

/**
 * 会话的界面级标记：置顶 / 归档。
 *
 * 这些状态不属于 pi-agent 的会话数据（SDK 无对应字段），只是本应用在会话列表里
 * 的偏好，因此用 localStorage 持久化（key 为会话 id，跨重启稳定）。会话被删除后
 * 由调用方通过 forget() 清掉遗留标记。
 */

const STORAGE_KEY = 'piforge.session-flags'

interface PersistedFlags {
  pinned: string[]
  archived: string[]
}

function readPersisted(): PersistedFlags {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { pinned: [], archived: [] }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const arr = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return { pinned: arr(parsed.pinned), archived: arr(parsed.archived) }
  } catch {
    return { pinned: [], archived: [] }
  }
}

function writePersisted(state: Pick<SessionFlagsState, 'pinned' | 'archived'>): void {
  try {
    const payload: PersistedFlags = { pinned: state.pinned, archived: state.archived }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 持久化失败只影响下次启动，不报错
  }
}

interface SessionFlagsState {
  /** 置顶会话 id 列表 */
  pinned: string[]
  /** 归档会话 id 列表 */
  archived: string[]
  isPinned: (id: string) => boolean
  isArchived: (id: string) => boolean
  togglePinned: (id: string) => void
  setArchived: (id: string, archived: boolean) => void
  /** 会话删除后清掉它的遗留标记 */
  forget: (id: string) => void
}

const initial = readPersisted()

export const useSessionFlagsStore = create<SessionFlagsState>((set, get) => ({
  pinned: initial.pinned,
  archived: initial.archived,

  isPinned: (id) => get().pinned.includes(id),

  isArchived: (id) => get().archived.includes(id),

  togglePinned: (id) =>
    set((state) => {
      const pinned = state.pinned.includes(id)
        ? state.pinned.filter((item) => item !== id)
        : [id, ...state.pinned]
      writePersisted({ pinned, archived: state.archived })
      return { pinned }
    }),

  setArchived: (id, archived) =>
    set((state) => {
      const next = archived
        ? [...state.archived, id]
        : state.archived.filter((item) => item !== id)
      writePersisted({ pinned: state.pinned, archived: next })
      return { archived: next }
    }),

  forget: (id) =>
    set((state) => {
      const pinned = state.pinned.filter((item) => item !== id)
      const archived = state.archived.filter((item) => item !== id)
      writePersisted({ pinned, archived })
      return { pinned, archived }
    })
}))
