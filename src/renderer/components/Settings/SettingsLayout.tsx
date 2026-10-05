import type { JSX, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 设置视图的展示原语。
 *
 * 只有展示职责：P1 全部为只读，因此这里没有输入控件。
 * P2 起在同一套 Row / Group 里替换成可写控件即可，不必重排布局。
 */

export function SectionShell({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export function SettingsGroup({
  title,
  description,
  children
}: {
  title?: string
  description?: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      {title && (
        <header className="border-b border-border bg-card/40 px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </header>
      )}
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

/** 一行设置：左侧标签与说明，右侧取值或控件 */
export function SettingsRow({
  label,
  hint,
  mono = false,
  children
}: {
  label: string
  hint?: string
  mono?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-start gap-4 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className={cn('text-xs text-foreground', mono && 'font-mono')}>{label}</div>
        {hint && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="max-w-[58%] shrink-0 text-right text-xs">{children}</div>
    </div>
  )
}

/** 取值文本；未设置明确显示为「未设置」而不是空白 */
export function ValueText({
  value,
  mono = false
}: {
  value: string | number | boolean | null | undefined
  mono?: boolean
}): JSX.Element {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">未设置</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-foreground">{value ? '已启用' : '已关闭'}</span>
  }
  return (
    <span className={cn('break-all text-foreground', mono && 'font-mono text-[11px]')}>
      {String(value)}
    </span>
  )
}

/** 字符串列表；空时给出明确空态 */
export function ValueList({
  items,
  empty = '未设置',
  mono = false
}: {
  items: readonly string[]
  empty?: string
  mono?: boolean
}): JSX.Element {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>

  return (
    <div className="flex flex-col items-end gap-0.5">
      {items.map((item) => (
        <span
          key={item}
          title={item}
          className={cn('max-w-full truncate text-foreground', mono && 'font-mono text-[11px]')}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/** 紧凑标签列表：适合工具名、MCP 服务器名这类短标识 */
export function ChipList({
  items,
  empty = '无'
}: {
  items: readonly string[]
  empty?: string
}): JSX.Element {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <span
          key={item}
          title={item}
          className="max-w-[16rem] truncate rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/** 提示块：用于降级说明、未接线说明等必须让用户看到的信息 */
export function NoticeBlock({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'warning'
  children: ReactNode
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
        tone === 'warning'
          ? 'border-warning/40 bg-warning/5 text-warning'
          : 'border-border bg-card/40 text-muted-foreground'
      )}
    >
      {children}
    </div>
  )
}
