import { useEffect, useState, type JSX } from 'react'
import {
  Copy,
  Cpu,
  Folder,
  Minus,
  Moon,
  PanelLeft,
  Settings,
  Square,
  Sun,
  X
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip } from '@renderer/components/ui/tooltip'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useProjectsStore } from '@renderer/stores/projects-store'
import { useThemeStore } from '@renderer/stores/theme-store'

/** 自定义标题栏：拖拽区 + 当前项目 + 主题/设置 + 窗口控制 */
export function TitleBar(): JSX.Element {
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const openSettings = useLayoutStore((s) => s.openSettings)
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <header className="app-drag flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-sidebar px-2">
      <Tooltip
        label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        side="bottom"
        className="app-no-drag"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          onClick={toggleSidebar}
        >
          <PanelLeft />
        </Button>
      </Tooltip>

      <div className="flex select-none items-center gap-1.5 pl-0.5">
        <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
          <Cpu className="size-3.5" />
        </span>
        <span className="text-xs font-semibold tracking-tight text-foreground">PiForge</span>
      </div>

      {/* 当前项目：项目切换已归到侧栏「项目」面板，这里只做展示 */}
      <div
        className="ml-1 flex min-w-0 max-w-[38%] items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground"
        title={activeProject?.path ?? '未选择项目'}
      >
        <Folder className="size-3.5 shrink-0" />
        <span className="truncate">
          {activeProject?.name ?? '未选择项目'}
        </span>
      </div>

      {/* 拖拽热区 */}
      <div className="min-w-2 flex-1" />

      <div className="app-no-drag flex items-center gap-0.5">
        <Tooltip label={resolvedTheme === 'dark' ? '切换到亮色' : '切换到暗色'} side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="切换主题"
            onClick={toggleTheme}
          >
            {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
          </Button>
        </Tooltip>

        <Tooltip label="设置" side="bottom">
          <Button variant="ghost" size="icon-sm" aria-label="设置" onClick={openSettings}>
            <Settings />
          </Button>
        </Tooltip>

        <WindowControls />
      </div>
    </header>
  )
}

/** 窗口控制按钮；macOS 使用系统内缩交通灯，不重复绘制 */
function WindowControls(): JSX.Element | null {
  const [maximized, setMaximized] = useState(false)
  const isMac = navigator.userAgent.includes('Mac')

  useEffect(() => {
    if (isMac) return
    void window.piforge.isWindowMaximized().then(setMaximized)
    return window.piforge.onWindowMaximizedChange(setMaximized)
  }, [isMac])

  if (isMac) return null

  const toggleMaximize = async (): Promise<void> => {
    setMaximized(await window.piforge.toggleMaximizeWindow())
  }

  return (
    <div className="ml-1 flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        aria-label="最小化"
        title="最小化"
        onClick={() => void window.piforge.minimizeWindow()}
      >
        <Minus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        aria-label={maximized ? '还原' : '最大化'}
        title={maximized ? '还原' : '最大化'}
        onClick={() => void toggleMaximize()}
      >
        {maximized ? <Copy /> : <Square />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md hover:bg-destructive hover:text-destructive-foreground"
        aria-label="关闭"
        title="关闭"
        onClick={() => void window.piforge.closeWindow()}
      >
        <X />
      </Button>
    </div>
  )
}
