import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/** 开关。没有原生语义可用的场景下用 role="switch" 明确表达 */
export function Switch({
  checked,
  disabled = false,
  onChange,
  label
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  label?: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        'outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-info' : 'bg-input'
      )}
    >
      <span
        className={cn(
          'inline-block size-3.5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.15rem]'
        )}
      />
    </button>
  )
}
