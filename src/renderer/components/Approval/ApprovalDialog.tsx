import type { JSX } from 'react'
import { useApprovalStore } from '@renderer/stores/approval-store'

/**
 * 危险操作确认弹窗。
 * 显示完整命令 / 入参、命中原因、工具与规则名，用户决定批准或拒绝。
 */
export function ApprovalDialog(): JSX.Element | null {
  const pending = useApprovalStore((s) => s.pending)
  const setPending = useApprovalStore((s) => s.setPending)

  if (!pending) return null

  const respond = async (approved: boolean): Promise<void> => {
    await window.piforge.respondApproval(pending.callId, approved)
    setPending(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <h2 className="text-base font-semibold text-foreground">危险操作需要确认</h2>
        </div>

        <p className="mt-3 text-sm text-amber-300">{pending.reason}</p>

        {pending.command && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">命令</div>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/70 p-3 font-mono text-xs text-foreground">
              {pending.command}
            </pre>
          </div>
        )}

        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            完整入参
          </div>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-background/70 p-3 font-mono text-xs text-muted-foreground">
            {pending.detail}
          </pre>
        </div>

        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>工具：{pending.tool}</span>
          {pending.rule && <span>规则：{pending.rule}</span>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
            onClick={() => void respond(false)}
          >
            拒绝
          </button>
          <button
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            onClick={() => void respond(true)}
          >
            批准执行
          </button>
        </div>
      </div>
    </div>
  )
}
