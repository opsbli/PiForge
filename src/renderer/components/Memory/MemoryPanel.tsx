import { useEffect, useState, type JSX } from 'react'
import { Brain } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogHeader } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import { useMemoryStore } from '@renderer/stores/memory-store'
import { cn } from '@renderer/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  decision: '决策',
  preference: '偏好',
  fact: '事实',
  debug_history: '调试历史'
}

/** 记忆管理面板：浏览 / 编辑 / 删除 / 搜索 */
export function MemoryPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const entries = useMemoryStore((s) => s.entries)
  const selected = useMemoryStore((s) => s.selected)
  const search = useMemoryStore((s) => s.search)
  const load = useMemoryStore((s) => s.load)
  const select = useMemoryStore((s) => s.select)
  const save = useMemoryStore((s) => s.save)
  const remove = useMemoryStore((s) => s.remove)
  const setSearch = useMemoryStore((s) => s.setSearch)

  const [draft, setDraft] = useState({
    name: '',
    description: '',
    type: 'fact',
    body: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (selected) {
      setDraft({
        name: selected.name,
        description: selected.description,
        type: selected.type,
        body: selected.body
      })
      setCreating(false)
    }
  }, [selected])

  if (!open) return null

  const filtered = entries.filter((entry) => {
    if (!search.trim()) return true
    const keyword = search.toLowerCase()
    return (
      entry.name.toLowerCase().includes(keyword) ||
      entry.description.toLowerCase().includes(keyword) ||
      entry.body.toLowerCase().includes(keyword)
    )
  })

  const startCreate = (): void => {
    setCreating(true)
    setDraft({ name: '', description: '', type: 'fact', body: '' })
  }

  const submit = async (): Promise<void> => {
    if (!draft.name.trim()) {
      window.alert('记忆名不能为空')
      return
    }
    await save({ ...draft, name: draft.name.trim() })
    setCreating(false)
  }

  return (
    <Dialog open={open} onClose={onClose} className="h-[80vh] max-w-4xl">
      <DialogHeader title="记忆管理" icon={<Brain className="size-4" />} onClose={onClose}>
        <Input
          className="w-44"
          placeholder="搜索记忆…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant="default" size="sm" onClick={startCreate}>
          新建记忆
        </Button>
      </DialogHeader>

      <div className="flex min-h-0 flex-1">
        {/* 左：列表 */}
        <ScrollArea className="w-72 shrink-0 border-r border-border p-2">
          {filtered.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {entries.length === 0 ? '暂无记忆（点「新建记忆」添加）' : '无匹配结果'}
            </p>
          ) : (
            filtered.map((entry) => (
              <button
                key={entry.name}
                type="button"
                className={cn(
                  'mb-1 w-full rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:bg-accent',
                  selected?.name === entry.name && 'bg-accent'
                )}
                onClick={() => void select(entry.name)}
              >
                <div className="truncate text-xs text-foreground">{entry.name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="rounded bg-secondary px-1">
                    {TYPE_LABEL[entry.type] ?? entry.type}
                  </span>
                  <span className="truncate">{entry.description}</span>
                </div>
              </button>
            ))
          )}
        </ScrollArea>

        {/* 右：详情 / 编辑 */}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {!selected && !creating ? (
            <p className="text-xs text-muted-foreground">从左侧选择一条记忆查看或编辑</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Input
                  className="h-6"
                  placeholder="记忆名（文件名，不含 .md）"
                  value={draft.name}
                  disabled={!creating}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                <Input
                  className="h-6"
                  placeholder="一句话描述（写入索引）"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
                <select
                  className="h-6 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Textarea
                  className="h-64 font-mono"
                  placeholder="记忆正文（Markdown）"
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                {selected && !creating && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`确定删除记忆 ${selected.name}？`)) {
                        void remove(selected.name)
                      }
                    }}
                  >
                    删除
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  disabled={!draft.name.trim()}
                  onClick={() => void submit()}
                >
                  保存
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
