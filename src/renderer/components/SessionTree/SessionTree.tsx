import { useCallback, useEffect, useState, type JSX } from 'react'
import { GitBranch } from 'lucide-react'
import type { TreeEntry } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogHeader } from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/lib/utils'

/** 会话树导航：查看树结构 / 导航到任意节点 / 分支切换时选择总结方式 */
export function SessionTree({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [leafId, setLeafId] = useState<string | null>(null)
  const [pending, setPending] = useState<TreeEntry | null>(null)
  const [summarize, setSummarize] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await window.piforge.getTree()
      setTree(result.tree)
      setLeafId(result.leafId)
    } catch {
      setTree([])
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  if (!open) return null

  const doNavigate = async (): Promise<void> => {
    if (!pending) return
    setBusy(true)
    try {
      const result = await window.piforge.navigateTree(pending.id, {
        summarize,
        customInstructions: summarize && customInstructions.trim() ? customInstructions : undefined,
        label: pending.label
      })
      setTree(result.tree)
      setLeafId(result.leafId)
      setPending(null)
      setCustomInstructions('')
      setSummarize(false)
    } catch (err) {
      window.alert(`导航失败：${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="h-[80vh] max-w-3xl">
      <DialogHeader title="会话树" icon={<GitBranch className="size-4" />} onClose={onClose}>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </DialogHeader>

      <div className="flex min-h-0 flex-1">
          {/* 树 */}
          <div className="flex-1 overflow-auto p-3 font-mono text-xs">
            {tree.length === 0 ? (
              <p className="text-muted-foreground">会话树为空（先发一条消息）</p>
            ) : (
              tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  leafId={leafId}
                  onPick={(n) => {
                    setPending(n)
                    setSummarize(false)
                    setCustomInstructions('')
                  }}
                />
              ))
            )}
          </div>

          {/* 导航选项 */}
          <div className="w-72 shrink-0 border-l border-border p-3">
            {!pending ? (
              <p className="text-xs text-muted-foreground">
                点击左侧任意节点以导航（当前 leaf 已标记）
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">导航到</div>
                  <div className="mt-1 break-all rounded bg-background/60 p-2 text-[11px] text-muted-foreground">
                    {pending.role ? `[${pending.role}] ` : ''}
                    {pending.preview || pending.id}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={summarize}
                    onChange={(e) => setSummarize(e.target.checked)}
                  />
                  总结被放弃的分支
                </label>

                {summarize && (
                  <Textarea
                    className="h-24"
                    placeholder="自定义总结提示词（留空用默认）"
                    value={customInstructions}
                    onChange={(event) => setCustomInstructions(event.target.value)}
                  />
                )}

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={busy}
                    onClick={() => void doNavigate()}
                  >
                    {busy ? '导航中…' : '确认导航'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                    取消
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
    </Dialog>
  )
}

function TreeRow({
  node,
  depth,
  leafId,
  onPick
}: {
  node: TreeEntry
  depth: number
  leafId: string | null
  onPick: (node: TreeEntry) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const isLeaf = node.id === leafId
  const hasChildren = node.children.length > 0

  const label = node.role ? `[${node.role}]` : `[${node.type}]`

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent',
          isLeaf && 'bg-success/15'
        )}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {hasChildren ? (
          <button className="text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="text-muted-foreground">·</span>
        )}
        <button className="flex-1 truncate text-left" onClick={() => onPick(node)}>
          <span className="text-muted-foreground">{label}</span>{' '}
          {node.preview || node.id}
          {isLeaf && <span className="ml-1 text-success">← 当前</span>}
        </button>
      </div>
      {hasChildren &&
        expanded &&
        node.children.map((child) => (
          <TreeRow key={child.id} node={child} depth={depth + 1} leafId={leafId} onPick={onPick} />
        ))}
    </div>
  )
}
