import { useEffect, type JSX } from 'react'
import { useCostStore } from '@renderer/stores/cost-store'

/** 会话列表：新建 / 切换 */
export function SessionList({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const sessions = useCostStore((s) => s.sessions)
  const refreshSessions = useCostStore((s) => s.refreshSessions)
  const newSession = useCostStore((s) => s.newSession)
  const switchSession = useCostStore((s) => s.switchSession)

  useEffect(() => {
    if (open) void refreshSessions()
  }, [open, refreshSessions])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">会话</h2>
          <div className="flex gap-2">
            <button
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
              onClick={() => void newSession()}
            >
              新建会话
            </button>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-auto">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无历史会话</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-accent"
                    onClick={() => void switchSession(s.path)}
                  >
                    <div className="truncate text-xs text-foreground">
                      {s.name ?? s.firstMessage ?? s.id}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.messageCount} 条消息 · {new Date(s.modified).toLocaleString('zh-CN')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
