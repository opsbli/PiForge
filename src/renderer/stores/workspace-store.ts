import { create } from 'zustand'

interface WorkspaceState {
  /** 当前工作区绝对路径 */
  workspace: string | null
  /** 当前打开的文件绝对路径 */
  openFilePath: string | null
  /** 编辑器内容 */
  content: string
  /** 是否有未保存修改 */
  dirty: boolean
  /** 文件树刷新信号（自增触发重载） */
  refreshToken: number

  setWorkspace: (path: string | null) => void
  openFile: (path: string, content: string) => void
  setContent: (content: string) => void
  markSaved: () => void
  closeFile: () => void
  refreshTree: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  openFilePath: null,
  content: '',
  dirty: false,
  refreshToken: 0,

  setWorkspace: (path) => set({ workspace: path }),
  openFile: (path, content) => set({ openFilePath: path, content, dirty: false }),
  setContent: (content) => set({ content, dirty: true }),
  markSaved: () => set({ dirty: false }),
  closeFile: () => set({ openFilePath: null, content: '', dirty: false }),
  refreshTree: () => set((s) => ({ refreshToken: s.refreshToken + 1 }))
}))
