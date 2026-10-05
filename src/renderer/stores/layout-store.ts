import { create } from 'zustand'

/**
 * 界面布局与视图偏好：侧栏宽度/折叠、右栏宽度/Tab、中栏主视图、编辑器显示模式。
 * 全部为纯 UI 偏好（不含任何凭据），持久化到 localStorage，见下方 STORAGE_KEY。
 */

export type MainView = 'chat' | 'editor' | 'terminal'
export type EditorMode = 'preview' | 'edit'
export type RightTab = 'files' | 'changes'
/** 设置页分区（供外部直接跳转到指定分类） */
export type SettingsSectionId =
  | 'general'
  | 'model'
  | 'tools'
  | 'sandbox'
  | 'context'
  | 'extensions'
  | 'packages'
  | 'skills'
  | 'mcp'
  | 'trust'
  | 'about'
export const SIDEBAR_DEFAULT_WIDTH = 272
export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 420
export const RIGHT_PANEL_DEFAULT_WIDTH = 360
export const RIGHT_PANEL_MIN_WIDTH = 280
export const RIGHT_PANEL_MAX_WIDTH = 560

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * 布局偏好持久化（localStorage）。
 * 只存界面布局这类非敏感值；凭据仍走 safeStorage，不进 localStorage。
 */
const STORAGE_KEY = 'piforge.layout'

interface PersistedLayout {
  sidebarWidth: number
  sidebarCollapsed: boolean
  rightPanelWidth: number
  rightPanelOpen: boolean
  rightTab: RightTab
  mainView: MainView
  autoOpenEditor: boolean
  editorMode: EditorMode
}

function readPersistedLayout(): Partial<PersistedLayout> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Partial<PersistedLayout> = {}

    if (typeof parsed.sidebarWidth === 'number') {
      result.sidebarWidth = clamp(parsed.sidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
    }
    if (typeof parsed.rightPanelWidth === 'number') {
      result.rightPanelWidth = clamp(
        parsed.rightPanelWidth,
        RIGHT_PANEL_MIN_WIDTH,
        RIGHT_PANEL_MAX_WIDTH
      )
    }
    if (typeof parsed.sidebarCollapsed === 'boolean') result.sidebarCollapsed = parsed.sidebarCollapsed
    if (typeof parsed.rightPanelOpen === 'boolean') result.rightPanelOpen = parsed.rightPanelOpen
    if (parsed.rightTab === 'files' || parsed.rightTab === 'changes') result.rightTab = parsed.rightTab
    if (parsed.mainView === 'chat' || parsed.mainView === 'editor' || parsed.mainView === 'terminal') {
      result.mainView = parsed.mainView
    }
    if (typeof parsed.autoOpenEditor === 'boolean') result.autoOpenEditor = parsed.autoOpenEditor
    if (parsed.editorMode === 'preview' || parsed.editorMode === 'edit') {
      result.editorMode = parsed.editorMode
    }

    return result
  } catch {
    // 解析失败时回到默认布局，不阻断启动
    return {}
  }
}

function persistLayout(state: LayoutState): void {
  try {
    const payload: PersistedLayout = {
      sidebarWidth: state.sidebarWidth,
      sidebarCollapsed: state.sidebarCollapsed,
      rightPanelWidth: state.rightPanelWidth,
      rightPanelOpen: state.rightPanelOpen,
      rightTab: state.rightTab,
      mainView: state.mainView,
      autoOpenEditor: state.autoOpenEditor,
      editorMode: state.editorMode
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 持久化失败只影响下次启动的布局，不报错
  }
}

interface LayoutState {
  sidebarWidth: number
  sidebarCollapsed: boolean
  rightPanelWidth: number
  rightPanelOpen: boolean
  rightTab: RightTab
  mainView: MainView
  /** 中栏是否处于设置视图（不入 MainView，因为它是覆盖模式而非对等视图） */
  settingsOpen: boolean
  /** 打开设置时定位到的分类 */
  settingsSection: SettingsSectionId
  /** 在文件面板打开文件后是否自动把中栏切到编辑器 */
  autoOpenEditor: boolean
  /** 编辑器显示模式偏好：Markdown 文件打开时用它，初始为预览；手动切换后记住 */
  editorMode: EditorMode

  /** 拖拽左栏边缘：正 delta 变宽 */
  resizeSidebar: (deltaX: number) => void
  resetSidebarWidth: () => void
  toggleSidebar: () => void

  /** 拖拽右栏边缘：负 delta 变宽（由调用方传入取反后的值） */
  resizeRightPanel: (deltaX: number) => void
  resetRightPanelWidth: () => void
  toggleRightPanel: () => void

  setRightTab: (tab: RightTab) => void
  setMainView: (view: MainView) => void
  setAutoOpenEditor: (value: boolean) => void
  setEditorMode: (value: EditorMode) => void

  openSettings: (section?: SettingsSectionId) => void
  closeSettings: () => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarCollapsed: false,
  rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  rightPanelOpen: true,
  rightTab: 'files',
  mainView: 'chat',
  settingsOpen: false,
  settingsSection: 'general',
  autoOpenEditor: true,
  editorMode: 'preview',
  ...readPersistedLayout(),

  resizeSidebar: (deltaX) =>
    set((state) => ({
      sidebarWidth: clamp(
        state.sidebarWidth + deltaX,
        SIDEBAR_MIN_WIDTH,
        SIDEBAR_MAX_WIDTH
      )
    })),
  resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  resizeRightPanel: (deltaX) =>
    set((state) => ({
      rightPanelWidth: clamp(
        state.rightPanelWidth + deltaX,
        RIGHT_PANEL_MIN_WIDTH,
        RIGHT_PANEL_MAX_WIDTH
      )
    })),
  resetRightPanelWidth: () => set({ rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setRightTab: (rightTab) => set({ rightTab }),
  setMainView: (mainView) => set({ mainView }),
  setAutoOpenEditor: (autoOpenEditor) => set({ autoOpenEditor }),
  setEditorMode: (editorMode) => set({ editorMode }),

  openSettings: (section = 'general') => set({ settingsOpen: true, settingsSection: section }),
  closeSettings: () => set({ settingsOpen: false })
}))

// 任一项变化后写回 localStorage（settingsOpen 不入持久化内容）
useLayoutStore.subscribe((state) => persistLayout(state))
