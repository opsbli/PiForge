import type { ComponentProps, JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 滚动容器。统一纵向滚动、禁止横向溢出，
 * 滚动条外观由 index.css 的全局 ::-webkit-scrollbar 规则决定。
 */
export function ScrollArea({
  className,
  children,
  ...props
}: ComponentProps<'div'>): JSX.Element {
  return (
    <div className={cn('min-h-0 overflow-y-auto overflow-x-hidden', className)} {...props}>
      {children}
    </div>
  )
}
