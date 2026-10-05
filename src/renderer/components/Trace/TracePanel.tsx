import { useCallback, useEffect, useState, type JSX } from 'react'
import { Activity } from 'lucide-react'
import type { TraceRow, SpanRow, TraceStats } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogHeader } from '@renderer/components/ui/dialog'
import { cn } from '@renderer/lib/utils'

const SPAN_COLOR: Record<string, string> = {
  user: 'text-info',
  llm: 'text-violet-400',
  tool: 'text-warning'
}

/** 本地 trace 查看面板：按时间浏览 / 展开事件流 / token 与成本分解 */
export function TracePanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [stats, setStats] = useState<TraceStats | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [spans, setSpans] = useState<SpanRow[]>([])

  const load = useCallback(async (): Promise<void> => {
    const [t, s] = await Promise.all([window.piforge.listTraces(50), window.piforge.getTraceStats()])
    setTraces(t)
    setStats(s)
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (!selected) {
      setSpans([])
      return
    }
    void window.piforge.listSpans(selected).then(setSpans)
  }, [selected])

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} className="h-[85vh] max-w-5xl">
      <DialogHeader title="本地 Trace" icon={<Activity className="size-4" />} onClose={onClose}>
        {stats && (
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span>运行 {stats.traceCount}</span>
            <span>↓{stats.totalInputTokens}</span>
            <span>↑{stats.totalOutputTokens}</span>
            <span>工具 {stats.toolCallCount}</span>
            <span className="text-success">${stats.totalCost.toFixed(4)}</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </DialogHeader>

      <div className="flex min-h-0 flex-1">
          {/* 左：trace 列表 */}
          <div className="w-80 shrink-0 overflow-auto border-r border-border p-2">
            {traces.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                暂无 trace（发一条消息后再来查看）
              </p>
            ) : (
              traces.map((t) => (
                <button
                  key={t.id}
                  className={cn(
                    'mb-1 w-full rounded-md border border-border px-2 py-1.5 text-left hover:bg-accent',
                    selected === t.id && 'bg-accent'
                  )}
                  onClick={() => setSelected(t.id)}
                >
                  <div className="truncate text-xs text-foreground">{t.user_prompt || '(空)'}</div>
                  <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
                    <span>{new Date(t.started_at).toLocaleTimeString('zh-CN')}</span>
                    <span className={t.status === 'ok' ? 'text-success' : 'text-destructive'}>
                      {t.status}
                    </span>
                    <span>↓{t.input_tokens} ↑{t.output_tokens}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 右：span 事件流 */}
          <div className="flex-1 overflow-auto p-3">
            {!selected ? (
              <p className="text-xs text-muted-foreground">从左侧选择一次运行查看完整事件流</p>
            ) : spans.length === 0 ? (
              <p className="text-xs text-muted-foreground">该 trace 暂无 span</p>
            ) : (
              <div className="space-y-2">
                {spans.map((s) => (
                  <div key={s.id} className="rounded-md border border-border bg-background/40 p-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn('font-mono', SPAN_COLOR[s.type] ?? 'text-muted-foreground')}>
                        [{s.type}]
                      </span>
                      <span className="text-foreground">{s.name}</span>
                      {s.duration_ms > 0 && (
                        <span className="text-muted-foreground">{s.duration_ms}ms</span>
                      )}
                      {s.type === 'llm' && (
                        <span className="text-muted-foreground">
                          ↓{s.input_tokens} ↑{s.output_tokens} ${s.cost.toFixed(4)}
                        </span>
                      )}
                      {s.error && <span className="text-destructive">错误</span>}
                    </div>
                    {(s.input || s.output) && (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-1.5 text-[10px] text-muted-foreground">
                        {s.input && `in: ${s.input}\n`}
                        {s.output && `out: ${s.output}`}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </Dialog>
  )
}
