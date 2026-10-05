import type { JSX, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const DOT_TONE: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info'
}

const TEXT_TONE: Record<StatusTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info'
}

/** 状态圆点，可选呼吸动画（用于进行中的任务） */
export function StatusDot({
  tone = 'neutral',
  pulse = false,
  className
}: {
  tone?: StatusTone
  pulse?: boolean
  className?: string
}): JSX.Element {
  return (
    <span
      className={cn('inline-block size-1.5 shrink-0 rounded-full', DOT_TONE[tone], pulse && 'animate-pulse', className)}
    />
  )
}

/** 状态徽标：圆点 + 文案 */
export function Badge({
  tone = 'neutral',
  pulse = false,
  children,
  className,
  title
}: {
  tone?: StatusTone
  pulse?: boolean
  children: ReactNode
  className?: string
  title?: string
}): JSX.Element {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1.5 text-xs', TEXT_TONE[tone], className)}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  )
}
