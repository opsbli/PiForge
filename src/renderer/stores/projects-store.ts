import { create } from 'zustand'
import type { ProjectRecord, ProjectState, SessionListItem } from '@shared/ipc-types'
import { useChatStore } from '@renderer/stores/chat-store'
import { useCostStore } from '@renderer/stores/cost-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

/**
 * 多项目状态。
 *
 * 项目列表以主进程为事实源（这里只镜像），会话按 `cwd` 分到对应项目。
 * 切换 / 新建项目会让主进程重启 agent，因此这些操作后要等 agent 就绪再刷新。
 */

/** 路径归一化：统一分隔符、去掉结尾分隔符、Windows 下大小写不敏感 */
export function normalizePath(path: string): string {
  const unified = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-zA-Z]:\//.test(unified) ? unified.toLowerCase() : unified
}

interface ProjectsState {
  projects: ProjectRecord[]
  activeProjectId: string | null
  /** 按项目路径（归一化）分组的会话，新的在前 */
  sessionsByProject: Record<string, SessionListItem[]>
  loaded: boolean

  load: () => Promise<void>
  refreshSessions: () => Promise<void>
  createFromFolder: () => Promise<void>
  createBlank: (name?: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  activate: (id: string) => Promise<void>
  /** 把主进程返回的状态镜像到本地并同步工作区 */
  applyState: (state: ProjectState) => void
}

function groupSessions(sessions: SessionListItem[]): Record<string, SessionListItem[]> {
  const grouped: Record<string, SessionListItem[]> = {}
  for (const session of sessions) {
    const cwd = session.cwd?.trim()
    if (!cwd) continue
    const key = normalizePath(cwd)
    ;(grouped[key] ??= []).push(session)
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified))
  }
  return grouped
}

let subscribed = false

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  sessionsByProject: {},
  loaded: false,

  load: async () => {
    if (!subscribed) {
      subscribed = true
      window.piforge.onProjectChanged((state) => get().applyState(state))
    }
    get().applyState(await window.piforge.getProjectState())
    set({ loaded: true })
    await Promise.all([
      get().refreshSessions(),
      useCostStore.getState().refreshSessions(),
      useCostStore.getState().refreshSummary()
    ])
    await useChatStore.getState().loadHistory()
  },

  refreshSessions: async () => {
    try {
      set({ sessionsByProject: groupSessions(await window.piforge.listAllSessions()) })
    } catch {
      set({ sessionsByProject: {} })
    }
  },

  createFromFolder: async () => {
    const state = await window.piforge.createProjectFromFolder()
    if (!state) return
    get().applyState(state)
    await syncRuntime()
  },

  createBlank: async (name) => {
    get().applyState(await window.piforge.createBlankProject(name ? { name } : undefined))
    await syncRuntime()
  },

  rename: async (id, name) => {
    get().applyState(await window.piforge.renameProject({ id, name }))
  },

  remove: async (id) => {
    get().applyState(await window.piforge.removeProject({ id }))
    await syncRuntime()
  },

  activate: async (id) => {
    if (get().activeProjectId === id) return
    get().applyState(await window.piforge.activateProject({ id }))
    await syncRuntime()
  },

  /** 把主进程返回的状态镜像到本地，并同步工作区 */
  applyState: (state: ProjectState) => {
    const previousActive = get().activeProjectId
    const active = state.projects.find((p) => p.id === state.activeProjectId) ?? null
    set({ projects: state.projects, activeProjectId: state.activeProjectId })
    if (!active) return
    const workspace = useWorkspaceStore.getState().workspace
    if (normalizePath(workspace ?? '') !== normalizePath(active.path)) {
      // 切到不同项目：关闭上一个项目遗留的打开文件，避免编辑器指向旧工作区
      useWorkspaceStore.getState().closeFile()
    }
    useWorkspaceStore.getState().setWorkspace(active.path)
    if (previousActive !== state.activeProjectId) {
      useWorkspaceStore.getState().refreshTree()
    }
  }
}))

/** 项目切换 / 新建后：等 agent 就绪，再刷新会话、摘要与对话历史 */
async function syncRuntime(): Promise<void> {
  await window.piforge.waitAgentReady()
  await Promise.all([
    useCostStore.getState().refreshSummary(),
    useCostStore.getState().refreshSessions(),
    useProjectsStore.getState().refreshSessions()
  ])
  await useChatStore.getState().loadHistory()
}
