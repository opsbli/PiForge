import { useEffect, useState, type JSX } from 'react'
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

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">记忆管理</h2>
          <div className="flex gap-2">
            <input
              className="w-48 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              placeholder="搜索记忆…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
              onClick={startCreate}
            >
              新建记忆
            </button>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 左：列表 */}
          <div className="w-72 shrink-0 overflow-auto border-r border-border p-2">
            {filtered.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                {entries.length === 0 ? '暂无记忆（点「新建记忆」添加）' : '无匹配结果'}
              </p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.name}
                  className={cn(
                    'mb-1 w-full rounded-md border border-border px-2 py-1.5 text-left hover:bg-accent',
                    selected?.name === e.name && 'bg-accent'
                  )}
                  onClick={() => void select(e.name)}
                >
                  <div className="truncate text-xs text-foreground">{e.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded bg-secondary px-1">
                      {TYPE_LABEL[e.type] ?? e.type}
                    </span>
                    <span className="truncate">{e.description}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 右：详情 / 编辑 */}
          <div className="flex min-w-0 flex-1 flex-col p-3">
            {!selected && !creating ? (
              <p className="text-xs text-muted-foreground">从左侧选择一条记忆查看或编辑</p>
            ) : (
              <>
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="记忆名（文件名，不含 .md）"
                    value={draft.name}
                    disabled={!creating}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="一句话描述（写入索引）"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                  <select
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  >
                    {Object.entries(TYPE_LABEL).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="h-64 w-full resize-none rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="记忆正文（Markdown）"
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  {selected && !creating && (
                    <button
                      className="rounded-md border border-red-500/50 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        if (window.confirm(`确定删除记忆 ${selected.name}？`)) {
                          void remove(selected.name)
                        }
                      }}
                    >
                      删除
                    </button>
                  )}
                  <button
                    className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
                    disabled={!draft.name.trim()}
                    onClick={() => void submit()}
                  >
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
