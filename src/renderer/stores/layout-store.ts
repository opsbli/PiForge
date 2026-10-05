import { create } from 'zustand'

/**
 * 界面布局状态：侧栏宽度/折叠、右栏宽度/Tab、中栏主视图。
 * 纯 UI 偏好，不做持久化（每次启动回到默认布局）。
 */

export type MainView = 'chat' | 'editor' | 'terminal'
export type RightTab = 'files' | 'changes'

export const SIDEBAR_DEFAULT_WIDTH = 272
export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 420
export const RIGHT_PANEL_DEFAULT_WIDTH = 360
export const RIGHT_PANEL_MIN_WIDTH = 280
export const RIGHT_PANEL_MAX_WIDTH = 560

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

interface LayoutState {
  sidebarWidth: number
  sidebarCollapsed: boolean
  rightPanelWidth: number
  rightPanelOpen: boolean
  rightTab: RightTab
  mainView: MainView

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
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarCollapsed: false,
  rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  rightPanelOpen: true,
  rightTab: 'files',
  mainView: 'chat',

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
  setMainView: (mainView) => set({ mainView })
}))
