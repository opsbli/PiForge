import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/** 1px 分隔线 */
export function Separator({
  orientation = 'horizontal',
  className
}: {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}): JSX.Element {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
    />
  )
}
