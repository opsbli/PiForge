import { useState, type JSX } from 'react'
import { ChevronRight, Terminal } from 'lucide-react'
import type { ToolMessage } from '@renderer/stores/chat-store'
import { StatusDot, type StatusTone } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'

const STATUS: Record<ToolMessage['status'], { tone: StatusTone; label: string }> = {
  running: { tone: 'warning', label: '进行中' },
  ok: { tone: 'success', label: '成功' },
  error: { tone: 'danger', label: '失败' }
}

/** 工具调用卡片：默认折叠，展开可见入参与结果 */
export function ToolCallCard({ message }: { message: ToolMessage }): JSX.Element {
  const [open, setOpen] = useState(message.status === 'error' || message.status === 'running')
  const status = STATUS[message.status]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
      >
        <ChevronRight
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs font-medium text-foreground">
          {message.tool}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusDot tone={status.tone} pulse={message.status === 'running'} />
          {status.label}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-2.5 py-2">
          <Field label="参数" value={message.args} />

          {message.result !== undefined && <Field label="结果" value={message.result} />}

          {message.error && (
            <p className="mt-2 font-mono text-[11px] text-destructive">{message.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: unknown }): JSX.Element {
  return (
    <div className="mt-2 first:mt-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <pre className="mt-1 max-h-52 overflow-auto rounded bg-background/70 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {formatValue(value)}
      </pre>
    </div>
  )
}

function formatValue(value: unknown): string {
  // 字符串原样展示（工具结果多为纯文本，JSON.stringify 会加上引号与转义）
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
