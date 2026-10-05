import { create } from 'zustand'

/**
 * 主题偏好（暗色为主，可切亮色，另支持跟随系统）。
 *
 * 说明：这里用 localStorage 只持久化「界面偏好」这一个非敏感值。
 * 凭据类数据（API Key）仍按项目约定走 Electron safeStorage，严禁落在 localStorage。
 */
export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'piforge.theme'

function readStoredMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw
  } catch {
    // localStorage 不可用时退回默认值
  }
  return 'dark'
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

/** 把主题模式解析为实际生效的明暗值 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light'
  return mode
}

/** 把解析结果落到 <html> 上，供 CSS 变量与原生控件（滚动条/表单）同步 */
function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  return resolved
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** 在明暗之间直接切换（不进入 system） */
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readStoredMode(),
  resolved: resolveTheme(readStoredMode()),

  setMode: (mode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 忽略持久化失败，本次会话仍生效
    }
    set({ mode, resolved: applyTheme(mode) })
  },

  toggle: () => {
    get().setMode(get().resolved === 'dark' ? 'light' : 'dark')
  }
}))

/**
 * 在 React 渲染前调用，避免首帧主题闪烁。
 * 同时注册系统主题变化监听，供 mode === 'system' 时跟随。
 */
export function initTheme(): void {
  const mode = readStoredMode()
  const resolved = applyTheme(mode)
  useThemeStore.setState({ mode, resolved })
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useThemeStore.getState().mode
    if (current === 'system') useThemeStore.getState().setMode('system')
  })
}
