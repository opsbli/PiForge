import type { JSX } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  title?: string
}

/** 分段控件（视图/模式切换），选中态以卡片底色 + 阴影表达 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
}): JSX.Element {
  return (
    <div
      role="tablist"
      className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-md bg-accent/50 p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title ?? option.label}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex h-6 select-none items-center gap-1.5 rounded px-2 text-xs transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
