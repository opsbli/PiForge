import { type JSX, type ReactNode } from 'react'
import { Activity, Brain, GitBranch, Plus, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { ProjectGroup } from '@renderer/components/layout/ProjectGroup'
import { useCostStore } from '@renderer/stores/cost-store'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { cn } from '@renderer/lib/utils'

export interface SidebarProps {
  onOpenSessionTree: () => void
  onOpenMemory: () => void
  onOpenTrace: () => void
}

/** 左栏：新建会话 + 主导航 + 项目列表 + 底部状态区 */
export function Sidebar({ onOpenSessionTree, onOpenMemory, onOpenTrace }: SidebarProps): JSX.Element {
  const width = useLayoutStore((s) => s.sidebarWidth)
  const openSettings = useLayoutStore((s) => s.openSettings)
  const workspace = useWorkspaceStore((s) => s.workspace)
  const newSession = useCostStore((s) => s.newSession)

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
      style={{ width }}
    >
      <div className="shrink-0 p-2">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          disabled={!workspace}
          onClick={() => void newSession()}
        >
          <Plus />
          <span className="truncate">新建会话</span>
          <span className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">
            Ctrl N
          </span>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 pb-2">
        <nav className="flex flex-col gap-0.5">
          <NavItem icon={GitBranch} label="会话树" onClick={onOpenSessionTree} />
          <NavItem icon={Brain} label="项目记忆" onClick={onOpenMemory} />
          <NavItem icon={Activity} label="可观测性" onClick={onOpenTrace} />
        </nav>

        <Separator className="my-2" />

        <ProjectGroup />
      </ScrollArea>

      <SidebarFooter onOpenSettings={openSettings} />
    </aside>
  )
}

function NavItem({
  icon: Icon,
  label,
  onClick,
  trailing
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  trailing?: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 w-full select-none items-center gap-2 rounded-md px-2 text-left text-xs',
        'text-sidebar-foreground/85 transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  )
}

/**
 * 底部状态区：只保留设置入口。
 * 「打开项目」已并入「项目」分组头部操作（见 ProjectGroup）。
 */
function SidebarFooter({ onOpenSettings }: { onOpenSettings: () => void }): JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-end border-t border-sidebar-border p-2">
      <Button variant="ghost" size="icon-sm" aria-label="设置" title="设置" onClick={onOpenSettings}>
        <Settings />
      </Button>
    </div>
  )
}
