import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { FileNode } from '@shared/ipc-types'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { cn } from '@renderer/lib/utils'

/** 工作区文件树：展开/折叠/新建/删除 */
export function FileTree(): JSX.Element {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const refreshToken = useWorkspaceStore((s) => s.refreshToken)
  const refreshTree = useWorkspaceStore((s) => s.refreshTree)

  // 待新建项（Electron 不支持 window.prompt，用内联输入框）
  const [creating, setCreating] = useState<{
    parentDir: string
    isDirectory: boolean
    depth: number
  } | null>(null)

  const startCreate = (parentDir: string, isDirectory: boolean, depth = 0): void => {
    setCreating({ parentDir, isDirectory, depth })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">资源管理器</span>
        {workspace && (
          <div className="flex gap-1">
            <IconButton title="新建文件" onClick={() => startCreate(workspace, false)}>
              ＋
            </IconButton>
            <IconButton title="新建文件夹" onClick={() => startCreate(workspace, true)}>
              ▤
            </IconButton>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 text-sm">
        {!workspace ? (
          <p className="px-1 text-xs text-muted-foreground">未选择工作区</p>
        ) : (
          <DirChildren
            dirPath={workspace}
            depth={0}
            refreshToken={refreshToken}
            creating={creating}
            onCreate={startCreate}
            onDone={async () => {
              setCreating(null)
              refreshTree()
            }}
            onCancel={() => setCreating(null)}
          />
        )}
      </div>
    </div>
  )
}

interface CreateCtx {
  parentDir: string
  isDirectory: boolean
  depth: number
}

function DirChildren({
  dirPath,
  depth,
  refreshToken,
  creating,
  onCreate,
  onDone,
  onCancel
}: {
  dirPath: string
  depth: number
  refreshToken: number
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

  return (
    <div>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={depth}
          refreshToken={refreshToken}
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
  creating,
  onCreate,
  onDone,
  onCancel
}: {
  node: FileNode
  depth: number
  refreshToken: number
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
      setOpen((v) => !v)
      return
    }
    try {
      const content = await window.piforge.readFile(node.path)
      openFile(node.path, content)
    } catch (err) {
      window.alert(`打开失败：${String(err)}`)
    }
  }

  const remove = async (): Promise<void> => {
    // Electron 支持 window.confirm
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
          'group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent',
          isActive && 'bg-accent'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button className="flex-1 truncate text-left text-xs" onClick={() => void handleClick()}>
          {node.isDirectory ? (open ? '▾ ' : '▸ ') : '· '}
          {node.name}
        </button>
        {node.isDirectory && (
          <button
            className="hidden text-xs text-muted-foreground group-hover:block"
            title="在此新建文件"
            onClick={() => onCreate(node.path, false, depth + 1)}
          >
            ＋
          </button>
        )}
        <button
          className="hidden text-xs text-red-400 group-hover:block"
          title="删除"
          onClick={() => void remove()}
        >
          ×
        </button>
      </div>
      {node.isDirectory && open && (
        <DirChildren
          dirPath={node.path}
          depth={depth + 1}
          refreshToken={refreshToken}
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
      await window.piforge.createEntry(parentDir, trimmed, isDirectory)
      await onDone()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div style={{ paddingLeft: `${depth * 12 + 4}px` }} className="py-0.5">
      <input
        ref={ref}
        className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        placeholder={isDirectory ? '文件夹名' : '文件名'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => void submit()}
      />
      {error && <p className="mt-0.5 text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      className="rounded border border-border px-1.5 text-xs hover:bg-accent"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
