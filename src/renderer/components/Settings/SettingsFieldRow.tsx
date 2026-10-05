import { useState, type JSX } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { readSettingsPath } from '@renderer/lib/settings-path'
import { cn } from '@renderer/lib/utils'
import { SettingsRow } from './SettingsLayout'

/**
 * 由字段规格驱动的设置行。
 *
 * 控件类型、可选值、是否允许当前 scope、是否需要重载全部来自 agent 侧下发的 spec，
 * 渲染进程不维护第二份字段表——两份表必然漂移。
 */
export function SettingsFieldRow({
  fieldKey,
  label,
  hint,
  enumLabels
}: {
  fieldKey: string
  label: string
  hint?: string
  enumLabels?: Record<string, string>
}): JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const draft = useSettingsStore((s) => s.draft)
  const scope = useSettingsStore((s) => s.scope)
  const setDraftValue = useSettingsStore((s) => s.setDraftValue)

  const spec = settings?.fields.find((field) => field.key === fieldKey)
  if (!spec) return null

  const explicit = readSettingsPath(settings?.effective, fieldKey) ?? null
  const resolved = readSettingsPath(settings?.resolvedValues, fieldKey)
  const value = fieldKey in draft ? draft[fieldKey] : explicit
  const dirty = fieldKey in draft
  const scopeAllowed = spec.scopes.includes(scope)

  if (!scopeAllowed) {
    return (
      <SettingsRow
        label={label}
        hint={`${hint ? `${hint} · ` : ''}仅可在用户级配置中设置`}
      >
        <span className="text-muted-foreground">{formatValue(resolved)}</span>
      </SettingsRow>
    )
  }

  return (
    <SettingsRow label={label} hint={hint}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {dirty && <span className="size-1.5 rounded-full bg-warning" title="有未保存的修改" />}
          <FieldControl
            kind={spec.kind}
            options={spec.options}
            enumLabels={enumLabels}
            min={spec.min}
            value={value}
            onChange={(next) => setDraftValue(fieldKey, next)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除该键，回到默认"
            aria-label="回到默认"
            disabled={explicit === null}
            onClick={() => setDraftValue(fieldKey, null)}
          >
            <RotateCcw />
          </Button>
        </div>
        <span className={cn('text-[10px] text-muted-foreground')}>
          生效值：{formatValue(resolved)}
          {spec.needsReload && explicit !== null ? ' · 改后需重载' : ''}
        </span>
      </div>
    </SettingsRow>
  )
}

function FieldControl({
  kind,
  options,
  enumLabels,
  min,
  value,
  onChange
}: {
  kind: string
  options?: string[]
  enumLabels?: Record<string, string>
  min?: number
  value: unknown
  onChange: (value: unknown) => void
}): JSX.Element {
  if (kind === 'boolean') {
    return <Switch checked={value === true} onChange={(next) => onChange(next)} />
  }

  if (kind === 'number') {
    return (
      <Input
        type="number"
        className="h-6 w-28 text-right text-[11px]"
        min={min}
        value={typeof value === 'number' ? value : ''}
        placeholder="未设置"
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
      />
    )
  }

  if (kind === 'enum') {
    return (
      <Select
        className="h-6 text-[11px]"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">未设置</option>
        {(options ?? []).map((option) => (
          <option key={option} value={option}>
            {enumLabels?.[option] ?? option}
          </option>
        ))}
      </Select>
    )
  }

  if (kind === 'stringArray') {
    return <StringListControl items={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
  }

  return (
    <Input
      className="h-6 w-56 font-mono text-[11px]"
      value={typeof value === 'string' ? value : ''}
      placeholder="未设置"
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
    />
  )
}

function StringListControl({
  items,
  onChange
}: {
  items: string[]
  onChange: (items: string[]) => void
}): JSX.Element {
  const [entry, setEntry] = useState('')

  const add = (): void => {
    const trimmed = entry.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setEntry('')
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {items.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">空</span>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-foreground"
            >
              <span className="max-w-[12rem] truncate" title={item}>
                {item}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`移除 ${item}`}
                onClick={() => onChange(items.filter((candidate) => candidate !== item))}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-1">
        <Input
          value={entry}
          className="h-6 w-40 text-[11px]"
          placeholder="新增一项…"
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button variant="outline" size="sm" disabled={!entry.trim()} onClick={add}>
          添加
        </Button>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '未设置'
  if (typeof value === 'boolean') return value ? '启用' : '关闭'
  if (Array.isArray(value)) return value.length === 0 ? '空数组' : value.join(', ')
  return String(value)
}
