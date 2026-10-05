import type { ComponentProps, JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/** 单行输入框 */
export function Input({ className, ...props }: ComponentProps<'input'>): JSX.Element {
  return (
    <input
      className={cn(
        'h-7 w-full min-w-0 rounded-md border border-input bg-card px-2 text-xs text-foreground',
        'outline-none transition-colors placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
