import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { FilePlus, FolderPlus, Search, Trash2 } from 'lucide-react'
import type { FileNode } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { DirectoryIcon, FileIcon } from '@renderer/components/FileTree/FileIcon'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { cn } from '@renderer/lib/utils'

interface CreateCtx {
  parentDir: string
  isDirectory: boolean
  depth: number
}

/** 工作区文件树：过滤 / 展开 / 新建 / 删除 */
export function FileTree(): JSX.Element {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const refreshToken = useWorkspaceStore((s) => s.refreshToken)
  const refreshTree = useWorkspaceStore((s) => s.refreshTree)
  const [filter, setFilter] = useState('')

  // 待新建项（Electron 不支持 window.prompt，用内联输入框）
  const [creating, setCreating] = useState<CreateCtx | null>(null)

  const startCreate = (parentDir: string, isDirectory: boolean, depth = 0): void => {
    setCreating({ parentDir, isDirectory, depth })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            placeholder="过滤文件…"
            className="h-6 pl-7 text-[11px]"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建文件"
          aria-label="新建文件"
          disabled={!workspace}
          onClick={() => workspace && startCreate(workspace, false)}
        >
          <FilePlus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建文件夹"
          aria-label="新建文件夹"
          disabled={!workspace}
          onClick={() => workspace && startCreate(workspace, true)}
        >
          <FolderPlus />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-1.5 py-1.5">
        {!workspace ? (
          <p className="px-1.5 text-[11px] text-muted-foreground">未选择工作区</p>
        ) : (
          <DirChildren
            dirPath={workspace}
            depth={0}
            refreshToken={refreshToken}
            filter={filter}
            creating={creating}
            onCreate={startCreate}
            onDone={async () => {
              setCreating(null)
              refreshTree()
            }}
            onCancel={() => setCreating(null)}
          />
        )}
      </ScrollArea>
    </div>
  )
}

/** 过滤规则：目录始终保留（便于继续下钻），只按关键字过滤文件 */
function filterNodes(nodes: FileNode[], keyword: string): FileNode[] {
  if (!keyword) return nodes
  const lowered = keyword.toLowerCase()
  return nodes.filter(
    (node) => node.isDirectory || node.name.toLowerCase().includes(lowered)
  )
}

function DirChildren({
  dirPath,
  depth,
  refreshToken,
  filter,
  creating,
  onCreate,
  onDone,
  onCancel
}: {
  dirPath: string
  depth: number
  refreshToken: number
  filter: string
  creating: CreateCtx | null
  onCreate: (parentDir: string, isDirectory: boolean, depth?: number) => void
  onDone: () => Promise<void>
  onCancel: () => void
}): JSX.Element {
  const [nodes, setNodes] = useState<FileNode[]>([])

  const load = useCallback(async (): Promise<void> => {
    try {
      setNodes(await window.piforge.listDir(dirPath))
    } catch {
      setNodes([])
    }
  }, [dirPath])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const visible = filterNodes(nodes, filter)

  return (
    <div>
      {visible.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={depth}
          refreshToken={refreshToken}
          filter={filter}
          creating={creating}
          onCreate={onCreate}
          onDone={onDone}
          onCancel={onCancel}
        />
      ))}
      {creating?.parentDir === dirPath && (
        <NewEntryInput
          depth={creating.depth}
          isDirectory={creating.isDirectory}
          parentDir={dirPath}
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  refreshToken,
  filter,
  creating,
  onCreate,
  onDone,
  onCancel
}: {
  node: FileNode
  depth: number
  refreshToken: number
  filter: string
  creating: CreateCtx | null
  onCreate: (parentDir: string, isDirectory: boolean, depth?: number) => void
  onDone: () => Promise<void>
  onCancel: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const openFile = useWorkspaceStore((s) => s.openFile)

  const handleClick = async (): Promise<void> => {
    if (node.isDirectory) {
      setOpen((value) => !value)
      return
    }
    try {
      const content = await window.piforge.readFile(node.path)
      openFile(node.path, content)
      // 打开文件后把中栏切到编辑器；设置页开启时或用户关闭该行为时不抢视图
      const layout = useLayoutStore.getState()
      if (layout.autoOpenEditor && !layout.settingsOpen) layout.setMainView('editor')
    } catch (err) {
      window.alert(`打开失败：${String(err)}`)
    }
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm(`确定删除 ${node.relativePath}？`)) return
    try {
      await window.piforge.deleteEntry(node.path)
      await onDone()
    } catch (err) {
      window.alert(`删除失败：${String(err)}`)
    }
  }

  const isActive = !node.isDirectory && openFilePath === node.path

  return (
    <div>
      <div
        className={cn(
          'group flex h-6 items-center gap-1.5 rounded px-1.5 transition-colors',
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={node.relativePath}
          onClick={() => void handleClick()}
        >
          {node.isDirectory ? (
            <DirectoryIcon open={open} />
          ) : (
            <FileIcon name={node.name} />
          )}
          <span className={cn('truncate text-xs', isActive && 'text-foreground')}>
            {node.name}
          </span>
        </button>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {node.isDirectory && (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="在此新建文件"
              aria-label="在此新建文件"
              onClick={() => onCreate(node.path, false, depth + 1)}
            >
              <FilePlus className="size-3" />
            </button>
          )}
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            title="删除"
            aria-label="删除"
            onClick={() => void remove()}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {node.isDirectory && open && (
        <DirChildren
          dirPath={node.path}
          depth={depth + 1}
          refreshToken={refreshToken}
          filter={filter}
          creating={creating}
          onCreate={onCreate}
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function NewEntryInput({
  parentDir,
  isDirectory,
  depth,
  onDone,
  onCancel
}: {
  parentDir: string
  isDirectory: boolean
  depth: number
  onDone: () => Promise<void>
  onCancel: () => void
}): JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      onCancel()
      return
    }
    try {
      const node = await window.piforge.createEntry(parentDir, trimmed, isDirectory)
      await onDone()
      // 新建文件后自动打开，方便直接编辑
      if (!isDirectory) {
        useWorkspaceStore.getState().openFile(node.path, '')
        const layout = useLayoutStore.getState()
        if (layout.autoOpenEditor && !layout.settingsOpen) layout.setMainView('editor')
      }
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div style={{ paddingLeft: `${depth * 12 + 6}px` }} className="py-0.5">
      <Input
        ref={ref}
        className="h-6 text-[11px]"
        placeholder={isDirectory ? '文件夹名' : '文件名'}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submit()
          if (event.key === 'Escape') onCancel()
        }}
        onBlur={() => void submit()}
      />
      {error && <p className="mt-0.5 text-[10px] text-destructive">{error}</p>}
    </div>
  )
}
