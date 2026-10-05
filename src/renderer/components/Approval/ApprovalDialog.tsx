import type { JSX, ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { useApprovalStore } from '@renderer/stores/approval-store'

/**
 * 危险操作确认弹窗。
 * 显示完整命令 / 入参、命中原因、工具与规则名，用户决定批准或拒绝。
 *
 * 刻意不响应 Esc 与遮罩点击：审批必须由用户显式做出选择，
 * 避免误关导致调用悬空（与改造前行为一致）。
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
    <Dialog open onClose={() => undefined} className="max-w-xl">
      <DialogHeader
        title="危险操作需要确认"
        icon={<TriangleAlert className="size-4 text-warning" />}
      />

      <DialogBody>
        <p className="text-xs leading-relaxed text-warning">{pending.reason}</p>

        {pending.command && (
          <Field label="命令">
            <pre className="font-mono text-[11px] text-foreground">{pending.command}</pre>
          </Field>
        )}

        <Field label="完整入参">
          <pre className="font-mono text-[11px] text-muted-foreground">{pending.detail}</pre>
        </Field>

        <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
          <span>工具：{pending.tool}</span>
          {pending.rule && <span>规则：{pending.rule}</span>}
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={() => void respond(false)}>
          拒绝
        </Button>
        <Button variant="danger" size="lg" onClick={() => void respond(true)}>
          批准执行
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 max-h-48 overflow-auto rounded-md bg-background/70 p-2.5">{children}</div>
    </div>
  )
}
