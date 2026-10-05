import { useState, type JSX, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/**
 * 可折叠分区（侧栏分组、文件树等复用）。
 * 默认非受控；传入 open + onOpenChange 可切换为受控。
 */
export function CollapsibleSection({
  title,
  icon,
  actions,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  headerClassName,
  bodyClassName,
  children
}: {
  title: string
  icon?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  headerClassName?: string
  bodyClassName?: string
  children: ReactNode
}): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const toggle = (): void => {
    const next = !open
    onOpenChange?.(next)
    if (!isControlled) setUncontrolledOpen(next)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className={cn('flex items-center gap-0.5 px-1', headerClassName)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
          />
          {icon}
          <span className="truncate">{title}</span>
        </button>
        {actions}
      </div>
      {open && <div className={bodyClassName}>{children}</div>}
    </div>
  )
}
