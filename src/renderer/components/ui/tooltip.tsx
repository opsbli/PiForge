import type { JSX, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

const SIDE_CLASS: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2'
}

/**
 * 纯 CSS 提示气泡（无 radix 依赖）。
 * 注意：会被祖先的 overflow 裁切，因此只在不会被裁切的位置使用；
 * 位于可滚动容器内的图标按钮请退化为原生 title 属性。
 */
export function Tooltip({
  label,
  side = 'top',
  className,
  children
}: {
  label: string
  side?: TooltipSide
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden whitespace-nowrap rounded border border-border bg-popover px-1.5 py-0.5',
          'text-[11px] text-popover-foreground shadow-md',
          'group-hover/tt:block group-focus-within/tt:block',
          SIDE_CLASS[side]
        )}
      >
        {label}
      </span>
    </span>
  )
}
