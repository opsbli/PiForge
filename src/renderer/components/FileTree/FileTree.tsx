import { useCallback, useEffect, useState, type JSX } from 'react'
import type { FileNode } from '@shared/ipc-types'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { cn } from '@renderer/lib/utils'

/** 工作区文件树：展开/折叠/新建/删除 */
export function FileTree(): JSX.Element {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const refreshToken = useWorkspaceStore((s) => s.refreshToken)
  const refreshTree = useWorkspaceStore((s) => s.refreshTree)

  const promptCreate = async (parentDir: string, isDirectory: boolean): Promise<void> => {
    const name = window.prompt(isDirectory ? '新建文件夹名：' : '新建文件名：')
    if (!name?.trim()) return
    try {
      await window.piforge.createEntry(parentDir, name.trim(), isDirectory)
      refreshTree()
    } catch (err) {
      window.alert(`创建失败：${String(err)}`)
    }
  }

  const remove = async (node: FileNode): Promise<void> => {
    if (!window.confirm(`确定删除 ${node.relativePath}？`)) return
    try {
      await window.piforge.deleteEntry(node.path)
      refreshTree()
    } catch (err) {
      window.alert(`删除失败：${String(err)}`)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">资源管理器</span>
        {workspace && (
          <div className="flex gap-1">
            <IconButton title="新建文件" onClick={() => void promptCreate(workspace, false)}>
              +
            </IconButton>
            <IconButton title="新建文件夹" onClick={() => void promptCreate(workspace, true)}>
              ▤
            </IconButton>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 text-sm">
        {!workspace ? (
          <p className="px-1 text-xs text-muted-foreground">未选择工作区</p>
        ) : (
          <DirChildren dirPath={workspace} depth={0} refreshToken={refreshToken} onDelete={remove} onCreate={promptCreate} />
        )}
      </div>
    </div>
  )
}

function DirChildren({
  dirPath,
  depth,
  refreshToken,
  onDelete,
  onCreate
}: {
  dirPath: string
  depth: number
  refreshToken: number
  onDelete: (node: FileNode) => void
  onCreate: (parentDir: string, isDirectory: boolean) => void
}): JSX.Element {
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState(false)

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

  // 顶层默认展开
  useEffect(() => {
    if (depth === 0) setExpanded(true)
  }, [depth])

  if (!expanded) {
    return (
      <button className="w-full px-1 py-0.5 text-left text-xs text-muted-foreground" onClick={() => setExpanded(true)}>
        展开…
      </button>
    )
  }

  return (
    <div>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={depth}
          refreshToken={refreshToken}
          onDelete={onDelete}
          onCreate={onCreate}
        />
      ))}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  refreshToken,
  onDelete,
  onCreate
}: {
  node: FileNode
  depth: number
  refreshToken: number
  onDelete: (node: FileNode) => void
  onCreate: (parentDir: string, isDirectory: boolean) => void
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
        <button
          className="hidden text-xs text-red-400 group-hover:block"
          title="删除"
          onClick={() => onDelete(node)}
        >
          ×
        </button>
      </div>
      {node.isDirectory && open && (
        <DirChildren
          dirPath={node.path}
          depth={depth + 1}
          refreshToken={refreshToken}
          onDelete={onDelete}
          onCreate={onCreate}
        />
      )}
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
