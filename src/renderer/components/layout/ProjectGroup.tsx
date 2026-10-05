import { useEffect, useMemo, useState, type JSX } from 'react'
import { FolderOpen, Plus, Search } from 'lucide-react'
import type { SessionListItem } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { CollapsibleSection } from '@renderer/components/ui/collapsible'
import { Input } from '@renderer/components/ui/input'
import { useCostStore } from '@renderer/stores/cost-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { basename, formatRelativeTime } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

/** 「项目」分组：当前工作区 + 会话列表（可过滤 / 可切换 / 可新建） */
export function ProjectGroup(): JSX.Element {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const sessions = useCostStore((s) => s.sessions)
  const refreshSessions = useCostStore((s) => s.refreshSessions)
  const newSession = useCostStore((s) => s.newSession)
  const switchSession = useCostStore((s) => s.switchSession)
  const activeSessionId = useCostStore((s) => s.summary?.sessionId ?? null)

  const [filter, setFilter] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const visibleSessions = useMemo(() => {
    const keyword = filter.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter((session) =>
      `${session.name ?? ''} ${session.firstMessage}`.toLowerCase().includes(keyword)
    )
  }, [sessions, filter])

  const openFolder = async (): Promise<void> => {
    const selected = await window.piforge.selectWorkspace()
    if (selected) setWorkspace(selected)
  }

  return (
    <CollapsibleSection
      title="项目"
      headerClassName="pr-1"
      actions={
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            title="过滤会话"
            aria-label="过滤会话"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="新建会话"
            aria-label="新建会话"
            disabled={!workspace}
            onClick={() => void newSession()}
          >
            <Plus />
          </Button>
        </>
      }
    >
      <div className="px-1">
        <button
          type="button"
          onClick={() => void openFolder()}
          title={workspace ?? '未选择工作区'}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-sidebar-accent"
        >
          <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            {workspace ? basename(workspace) : '未选择工作区'}
          </span>
        </button>

        {searchOpen && (
          <div className="mt-1.5">
            <Input
              autoFocus
              value={filter}
              placeholder="过滤会话…"
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setFilter('')
                  setSearchOpen(false)
                }
              }}
            />
          </div>
        )}

        <div className="mt-1 flex flex-col gap-0.5 pb-1">
          {!workspace ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">先选择一个工作区</p>
          ) : visibleSessions.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              {filter ? '没有匹配的会话' : '暂无历史会话'}
            </p>
          ) : (
            visibleSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                onSelect={() => void switchSession(session.path)}
              />
            ))
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}

function SessionRow({
  session,
  active,
  onSelect
}: {
  session: SessionListItem
  active: boolean
  onSelect: () => void
}): JSX.Element {
  const title = session.name?.trim() || session.firstMessage?.trim() || session.id.slice(0, 12)

  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/60'
      )}
    >
      <span className="truncate text-xs">{title}</span>
      <span className="truncate text-[10px] text-muted-foreground">
        {session.messageCount} 条 · {formatRelativeTime(session.modified)}
      </span>
    </button>
  )
}
