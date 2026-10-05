import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2
} from 'lucide-react'
import type { ProjectRecord, SessionListItem } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { CollapsibleSection } from '@renderer/components/ui/collapsible'
import { Input } from '@renderer/components/ui/input'
import { useCostStore } from '@renderer/stores/cost-store'
import { normalizePath, useProjectsStore } from '@renderer/stores/projects-store'
import { formatRelativeTime } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

/**
 * 「项目」分组：多项目管理。
 *
 * 头部操作：折叠所有项目 / 从本地文件夹创建项目 / 新建空白项目。
 * 项目行：展开切换 + 名称 + 类型徽标 + 当前项标记，hover 出「…」（重命名 / 删除）与「+」（新建会话）。
 * 展开后列出该项目的会话（按 cwd 分组）。
 */
export function ProjectGroup(): JSX.Element {
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const sessionsByProject = useProjectsStore((s) => s.sessionsByProject)
  const load = useProjectsStore((s) => s.load)
  const refreshSessions = useProjectsStore((s) => s.refreshSessions)
  const createFromFolder = useProjectsStore((s) => s.createFromFolder)
  const createBlank = useProjectsStore((s) => s.createBlank)
  const renameProject = useProjectsStore((s) => s.rename)
  const removeProject = useProjectsStore((s) => s.remove)
  const activateProject = useProjectsStore((s) => s.activate)

  const newSession = useCostStore((s) => s.newSession)
  const switchSession = useCostStore((s) => s.switchSession)
  const activeSessionId = useCostStore((s) => s.summary?.sessionId ?? null)

  const [filter, setFilter] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  // 当前项目始终保持展开
  useEffect(() => {
    if (!activeProjectId) return
    setExpanded((prev) => (prev.has(activeProjectId) ? prev : new Set(prev).add(activeProjectId)))
  }, [activeProjectId])

  const keyword = filter.trim().toLowerCase()
  const visibleProjects = useMemo(() => {
    if (!keyword) return projects
    return projects.filter((project) =>
      project.name.toLowerCase().includes(keyword)
    )
  }, [projects, keyword])

  const sessionsOf = (project: ProjectRecord): SessionListItem[] =>
    sessionsByProject[normalizePath(project.path)] ?? []

  const toggleExpanded = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const collapseAll = (): void => setExpanded(new Set())

  const handleNewSession = async (project: ProjectRecord): Promise<void> => {
    setMenuId(null)
    setExpanded((prev) => new Set(prev).add(project.id))
    setBusyId(project.id)
    try {
      if (project.id === activeProjectId) {
        await newSession()
      } else {
        // 切换项目本身就会得到一个新会话
        await activateProject(project.id)
      }
      await refreshSessions()
    } finally {
      setBusyId(null)
    }
  }

  const startRename = (project: ProjectRecord): void => {
    setMenuId(null)
    setRenamingId(project.id)
    setRenameValue(project.name)
  }

  const commitRename = async (project: ProjectRecord): Promise<void> => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (name && name !== project.name) await renameProject(project.id, name)
  }

  const handleRemove = async (project: ProjectRecord): Promise<void> => {
    setMenuId(null)
    const hint =
      project.kind === 'blank'
        ? '该项目为应用管理的空白项目，删除后其目录会被清理。'
        : '项目文件位于本地磁盘，删除只会移除这里的登记，不会删除任何文件。'
    if (!window.confirm(`确定删除项目「${project.name}」？\n\n${hint}`)) return
    await removeProject(project.id)
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
            aria-label="过滤项目"
            title="过滤项目"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="折叠所有项目"
            title="折叠所有项目"
            onClick={collapseAll}
          >
            <ChevronsDownUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="从本地文件夹创建项目"
            title="从本地文件夹创建项目"
            onClick={() => void createFromFolder()}
          >
            <FolderPlus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="新建空白项目"
            title="新建空白项目"
            onClick={() => void createBlank()}
          >
            <Plus />
          </Button>
        </>
      }
    >
      <div className="px-1">
        {searchOpen && (
          <div className="mt-1.5">
            <Input
              autoFocus
              value={filter}
              placeholder="过滤项目…"
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
          {visibleProjects.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              {keyword ? '没有匹配的项目' : '还没有项目，点上方按钮创建'}
            </p>
          ) : (
            visibleProjects.map((project) => {
              const isActive = project.id === activeProjectId
              const isExpanded = expanded.has(project.id) || Boolean(keyword)
              const sessions = sessionsOf(project)
              return (
                <div key={project.id}>
                  <div
                    className={cn(
                      'group/project flex h-7 items-center gap-1 rounded-md px-1 text-xs transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/60'
                    )}
                  >
                    <button
                      type="button"
                      aria-label={isExpanded ? '折叠项目' : '展开项目'}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(project.id)}
                      className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight
                        className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => void activateProject(project.id)}
                      title={project.path}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                      {renamingId === project.id ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          className="h-5 min-w-0 flex-1 px-1 text-xs"
                          onChange={(event) => setRenameValue(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commitRename(project)
                            if (event.key === 'Escape') setRenamingId(null)
                          }}
                          onBlur={() => void commitRename(project)}
                        />
                      ) : (
                        <>
                          <span className="truncate font-medium">{project.name}</span>
                          <span className="shrink-0 rounded-full bg-sidebar-accent px-1.5 py-px text-[10px] text-muted-foreground">
                            {project.kind === 'blank' ? '空白项目' : '本地项目'}
                          </span>
                        </>
                      )}
                    </button>

                    {busyId === project.id ? (
                      <span className="shrink-0 px-1 text-[10px] text-muted-foreground">…</span>
                    ) : isActive && renamingId !== project.id ? (
                      <ChevronLeft className="size-3 shrink-0 text-muted-foreground" />
                    ) : null}

                    {renamingId !== project.id && (
                      <>
                        <div className="relative shrink-0">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                              'size-5 opacity-0 group-hover/project:opacity-100',
                              menuId === project.id && 'opacity-100'
                            )}
                            aria-label="项目操作"
                            title="项目操作"
                            onClick={() => setMenuId((id) => (id === project.id ? null : project.id))}
                          >
                            <MoreHorizontal />
                          </Button>
                          {menuId === project.id && (
                            <ProjectMenu
                              onRename={() => startRename(project)}
                              onRemove={() => void handleRemove(project)}
                              onClose={() => setMenuId(null)}
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-5 shrink-0"
                          aria-label="新建会话"
                          title="新建会话"
                          disabled={busyId !== null}
                          onClick={() => void handleNewSession(project)}
                        >
                          <Plus />
                        </Button>
                      </>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mb-0.5 ml-5 flex flex-col gap-0.5 border-l border-sidebar-border pl-1.5">
                      {sessions.length === 0 ? (
                        <p className="px-2 py-1 text-[11px] text-muted-foreground">暂无历史会话</p>
                      ) : (
                        sessions.map((session) => (
                          <SessionRow
                            key={session.id}
                            session={session}
                            active={isActive && session.id === activeSessionId}
                            onSelect={() => {
                              if (isActive) {
                                void switchSession(session.path)
                              } else {
                                void activateProject(project.id).then(() =>
                                  switchSession(session.path)
                                )
                              }
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}

/** 项目行的「…」菜单：重命名 / 删除项目 */
function ProjectMenu({
  onRename,
  onRemove,
  onClose
}: {
  onRename: () => void
  onRemove: () => void
  onClose: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-md border border-border bg-popover py-1 text-xs shadow-md"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onRename}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
      >
        <Pencil className="size-3.5" />
        重命名
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onRemove}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
        删除项目
      </button>
    </div>
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
      <span className="flex items-center gap-1 truncate text-xs">
        {active && <Check className="size-3 shrink-0 text-primary" />}
        <span className="truncate">{title}</span>
      </span>
      <span className="truncate text-[10px] text-muted-foreground">
        {session.messageCount} 条 · {formatRelativeTime(session.modified)}
      </span>
    </button>
  )
}
