import { useEffect, type JSX, type ReactNode } from 'react'
import { Activity, Brain, FolderOpen, GitBranch, Plus, Settings, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { ProjectGroup } from '@renderer/components/layout/ProjectGroup'
import { useCostStore } from '@renderer/stores/cost-store'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useSandboxStore } from '@renderer/stores/sandbox-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { basename } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

export interface SidebarProps {
  onOpenSessionTree: () => void
  onOpenMemory: () => void
  onOpenTrace: () => void
}

/** 左栏：新建会话 + 主导航 + 项目会话列表 + 底部状态区 */
export function Sidebar({ onOpenSessionTree, onOpenMemory, onOpenTrace }: SidebarProps): JSX.Element {
  const width = useLayoutStore((s) => s.sidebarWidth)
  const openSettings = useLayoutStore((s) => s.openSettings)
  const workspace = useWorkspaceStore((s) => s.workspace)
  const newSession = useCostStore((s) => s.newSession)

  const sandbox = useSandboxStore((s) => s.status)
  const refreshSandbox = useSandboxStore((s) => s.refresh)
  useEffect(() => {
    void refreshSandbox()
  }, [refreshSandbox])

  const isDocker = sandbox?.mode === 'docker'

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
          <NavItem
            icon={ShieldCheck}
            label="沙箱"
            onClick={openSettings}
            trailing={
              <Badge tone={isDocker ? 'success' : 'warning'} className="text-[10px]">
                {isDocker ? 'Docker' : '本地'}
              </Badge>
            }
          />
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

function SidebarFooter({ onOpenSettings }: { onOpenSettings: () => void }): JSX.Element {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)

  const openFolder = async (): Promise<void> => {
    const selected = await window.piforge.selectWorkspace()
    if (selected) setWorkspace(selected)
  }

  return (
    <div className="shrink-0 border-t border-sidebar-border p-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void openFolder()}
          title={workspace ?? '未选择工作区'}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <span className="truncate">{workspace ? basename(workspace) : '未选择工作区'}</span>
        </button>
        <Button variant="ghost" size="icon-sm" aria-label="设置" title="设置" onClick={onOpenSettings}>
          <Settings />
        </Button>
      </div>
    </div>
  )
}
