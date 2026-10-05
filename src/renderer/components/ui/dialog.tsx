import { useEffect, type JSX, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from './button'

/**
 * 通用弹窗。统一遮罩、Esc 关闭、点击遮罩关闭与最大高度约束。
 * 供审批 / 设置 / 记忆 / 会话树 / 可观测性等面板复用。
 */
export function Dialog({
  open,
  onClose,
  children,
  className
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({
  title,
  description,
  icon,
  onClose,
  children
}: {
  title: string
  description?: string
  icon?: ReactNode
  onClose?: () => void
  children?: ReactNode
}): JSX.Element {
  return (
    <div className="flex shrink-0 items-start gap-2.5 border-b border-border px-4 py-3">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {onClose && (
        <Button variant="ghost" size="icon-sm" aria-label="关闭" onClick={onClose}>
          <X />
        </Button>
      )}
    </div>
  )
}

export function DialogBody({
  className,
  children
}: {
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className={cn('min-h-0 flex-1 overflow-auto px-4 py-3', className)}>{children}</div>
  )
}

export function DialogFooter({
  className,
  children
}: {
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  )
}
