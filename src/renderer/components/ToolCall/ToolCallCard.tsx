import type { JSX } from 'react'
import type { ToolMessage } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'

const STATUS_STYLE: Record<ToolMessage['status'], { dot: string; label: string }> = {
  running: { dot: 'bg-amber-400', label: '进行中' },
  ok: { dot: 'bg-emerald-400', label: '成功' },
  error: { dot: 'bg-red-400', label: '失败' }
}

/** 单个工具调用卡片：区分进行中 / 成功 / 失败 */
export function ToolCallCard({ message }: { message: ToolMessage }): JSX.Element {
  const style = STATUS_STYLE[message.status]

  return (
    <div className="rounded-md border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', style.dot)} />
        <span className="font-mono text-sm font-semibold text-foreground">{message.tool}</span>
        <span className="text-xs text-muted-foreground">{style.label}</span>
      </div>

      <div className="mt-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">参数</div>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/60 p-2 font-mono text-xs text-muted-foreground">
          {safeJson(message.args)}
        </pre>
      </div>

      {message.result !== undefined && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">结果</div>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/60 p-2 font-mono text-xs text-muted-foreground">
            {safeJson(message.result)}
          </pre>
        </div>
      )}

      {message.error && <p className="mt-2 font-mono text-xs text-red-400">{message.error}</p>}
    </div>
  )
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
