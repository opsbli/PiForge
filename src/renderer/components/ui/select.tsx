import type { ComponentProps, JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/** 原生 select 的样式化封装（保持原生行为，不引入下拉组件库） */
export function Select({ className, ...props }: ComponentProps<'select'>): JSX.Element {
  return (
    <select
      className={cn(
        'h-7 max-w-full rounded-md border border-input bg-card px-2 text-xs text-foreground',
        'outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
