import type { ComponentProps, JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/** 多行输入框（默认关闭手动缩放，由调用方决定高度） */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>): JSX.Element {
  return (
    <textarea
      className={cn(
        'w-full min-w-0 resize-none rounded-md border border-input bg-card px-2.5 py-2 text-xs text-foreground',
        'outline-none transition-colors placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
