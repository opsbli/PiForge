import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Quote,
  Search,
  Trash2
} from 'lucide-react'
import type { ProjectRecord, SessionListItem } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { CollapsibleSection } from '@renderer/components/ui/collapsible'
import { Input } from '@renderer/components/ui/input'
import { sessionLabel, SESSION_DRAG_MIME, type SessionDragPayload } from '@renderer/lib/composer-references'
import { useCostStore } from '@renderer/stores/cost-store'
import { useComposerStore } from '@renderer/stores/composer-store'
import { normalizePath, useProjectsStore } from '@renderer/stores/projects-store'
import { useSessionFlagsStore } from '@renderer/stores/session-flags-store'
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
  const renameSession = useProjectsStore((s) => s.renameSession)
  const deleteSession = useProjectsStore((s) => s.deleteSession)

  const pinnedIds = useSessionFlagsStore((s) => s.pinned)
  const archivedIds = useSessionFlagsStore((s) => s.archived)
  const togglePinned = useSessionFlagsStore((s) => s.togglePinned)
  const setArchived = useSessionFlagsStore((s) => s.setArchived)

  const newSession = useCostStore((s) => s.newSession)
  const switchSession = useCostStore((s) => s.switchSession)
  const activeSessionId = useCostStore((s) => s.summary?.sessionId ?? null)

  const [filter, setFilter] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [archivedOpen, setArchivedOpen] = useState<Set<string>>(new Set())
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

  const handleQuoteSession = (session: SessionListItem): void => {
    useComposerStore.getState().addReferences([
      {
        id: `&${session.id}`,
        kind: '&',
        label: sessionLabel(session),
        value: session.id,
        title: `引用会话：${sessionLabel(session)}`
      }
    ])
  }

  const handleDeleteSession = async (session: SessionListItem): Promise<void> => {
    if (
      !window.confirm(
        `确定删除会话「${sessionLabel(session)}」？\n\n该操作不可撤销，会话文件将被删除。`
      )
    )
      return
    await deleteSession(session.id, session.path)
  }

  const toggleArchivedOpen = (projectId: string): void => {
    setArchivedOpen((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
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
                        <>
                          {sortSessions(
                            sessions.filter((session) => !archivedIds.includes(session.id)),
                            pinnedIds
                          ).map((session) => (
                            <SessionRow
                              key={session.id}
                              session={session}
                              active={isActive && session.id === activeSessionId}
                              pinned={pinnedIds.includes(session.id)}
                              archived={false}
                              onSelect={() => {
                                if (isActive) {
                                  void switchSession(session.path)
                                } else {
                                  void activateProject(project.id).then(() =>
                                    switchSession(session.path)
                                  )
                                }
                              }}
                              onTogglePin={() => togglePinned(session.id)}
                              onToggleArchive={() => setArchived(session.id, true)}
                              onQuote={() => handleQuoteSession(session)}
                              onRename={(name) => void renameSession(session.path, name)}
                              onDelete={() => void handleDeleteSession(session)}
                            />
                          ))}

                          {(() => {
                            const archivedSessions = sessions.filter((session) =>
                              archivedIds.includes(session.id)
                            )
                            if (archivedSessions.length === 0) return null
                            const open = archivedOpen.has(project.id)
                            return (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => toggleArchivedOpen(project.id)}
                                  className="flex h-6 w-full items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronRight
                                    className={cn('size-3 transition-transform', open && 'rotate-90')}
                                  />
                                  已归档（{archivedSessions.length}）
                                </button>
                                {open &&
                                  archivedSessions.map((session) => (
                                    <SessionRow
                                      key={session.id}
                                      session={session}
                                      active={isActive && session.id === activeSessionId}
                                      pinned={pinnedIds.includes(session.id)}
                                      archived
                                      onSelect={() => {
                                        if (isActive) {
                                          void switchSession(session.path)
                                        } else {
                                          void activateProject(project.id).then(() =>
                                            switchSession(session.path)
                                          )
                                        }
                                      }}
                                      onTogglePin={() => togglePinned(session.id)}
                                      onToggleArchive={() => setArchived(session.id, false)}
                                      onQuote={() => handleQuoteSession(session)}
                                      onRename={(name) => void renameSession(session.path, name)}
                                      onDelete={() => void handleDeleteSession(session)}
                                    />
                                  ))}
                              </div>
                            )
                          })()}
                        </>
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

/** 会话列表排序：置顶在前，其余按修改时间倒序 */
function sortSessions(sessions: SessionListItem[], pinnedIds: string[]): SessionListItem[] {
  const pinnedSet = new Set(pinnedIds)
  return [...sessions].sort((a, b) => {
    const pa = pinnedSet.has(a.id) ? 1 : 0
    const pb = pinnedSet.has(b.id) ? 1 : 0
    if (pa !== pb) return pb - pa
    return Date.parse(b.modified) - Date.parse(a.modified)
  })
}

function SessionRow({
  session,
  active,
  pinned,
  archived,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onQuote,
  onRename,
  onDelete
}: {
  session: SessionListItem
  active: boolean
  pinned: boolean
  archived: boolean
  onSelect: () => void
  onTogglePin: () => void
  onToggleArchive: () => void
  onQuote: () => void
  onRename: (name: string) => void
  onDelete: () => void
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const committedRef = useRef(false)

  const title = session.name?.trim() || session.firstMessage?.trim() || session.id.slice(0, 12)

  const startRename = (): void => {
    setMenuOpen(false)
    committedRef.current = false
    setRenaming(true)
    setRenameValue(session.name ?? '')
  }

  const commitRename = (): void => {
    // 防止 Enter 提交与输入框卸载时的 blur 重复提交
    if (committedRef.current) return
    committedRef.current = true
    const name = renameValue.trim()
    setRenaming(false)
    if (name && name !== (session.name ?? '')) onRename(name)
  }

  return (
    <div
      className={cn(
        'group/session relative flex items-center rounded-md transition-colors',
        active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        draggable={!renaming}
        onDragStart={(event) => {
          const payload: SessionDragPayload = {
            id: session.id,
            label: sessionLabel(session),
            path: session.path
          }
          event.dataTransfer.effectAllowed = 'copy'
          event.dataTransfer.setData(SESSION_DRAG_MIME, JSON.stringify(payload))
        }}
        title={title}
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5 text-left"
      >
        {renaming ? (
          <Input
            autoFocus
            value={renameValue}
            className="h-5 min-w-0 flex-1 px-1 text-xs"
            onChange={(event) => setRenameValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
          />
        ) : (
          <>
            <span className="flex items-center gap-1 truncate text-xs">
              {active && <Check className="size-3 shrink-0 text-primary" />}
              {pinned && <Pin className="size-3 shrink-0 text-primary" />}
              <span className="truncate">{title}</span>
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {session.messageCount} 条 · {formatRelativeTime(session.modified)}
            </span>
          </>
        )}
      </button>

      {!renaming && (
        <div className="mr-1 flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'size-5 opacity-0 group-hover/session:opacity-100',
              archived && 'opacity-100'
            )}
            aria-label={archived ? '取消归档' : '归档会话'}
            title={archived ? '取消归档' : '归档会话'}
            onClick={onToggleArchive}
          >
            {archived ? <ArchiveRestore /> : <Archive />}
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                'size-5 opacity-0 group-hover/session:opacity-100',
                menuOpen && 'opacity-100'
              )}
              aria-label="会话操作"
              title="会话操作"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <MoreHorizontal />
            </Button>
            {menuOpen && (
              <SessionMenu
                pinned={pinned}
                onTogglePin={() => {
                  setMenuOpen(false)
                  onTogglePin()
                }}
                onQuote={() => {
                  setMenuOpen(false)
                  onQuote()
                }}
                onRename={startRename}
                onDelete={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 会话行的「…」菜单：置顶 / 引用会话 / 重命名 / 删除会话 */
function SessionMenu({
  pinned,
  onTogglePin,
  onQuote,
  onRename,
  onDelete,
  onClose
}: {
  pinned: boolean
  onTogglePin: () => void
  onQuote: () => void
  onRename: () => void
  onDelete: () => void
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
        onClick={onTogglePin}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
      >
        {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        {pinned ? '取消置顶' : '置顶'}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onQuote}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
      >
        <Quote className="size-3.5" />
        引用会话
      </button>
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
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
        删除会话
      </button>
    </div>
  )
}
