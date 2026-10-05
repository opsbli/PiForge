import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { Brain, Check, ChevronDown, CornerDownLeft, Paperclip, Search, Zap } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  modelLabelOf,
  thinkingLabel,
  useComposerStore
} from '@renderer/stores/composer-store'
import { cn } from '@renderer/lib/utils'

/** 输入框底部工具栏：审批模式 / 思考深度 / 附件 / 上下文用量 / 模型选择器 / 发送 */
export function ComposerToolbar({
  canSend,
  onSend
}: {
  canSend: boolean
  onSend: () => void
}): JSX.Element {
  const approvalMode = useComposerStore((s) => s.approvalMode)
  const toggleApprovalMode = useComposerStore((s) => s.toggleApprovalMode)

  return (
    <div className="flex items-center gap-0.5 px-1 pb-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="审批模式"
        title={
          approvalMode === 'auto'
            ? '完全自动\n所有工具调用自动允许\n点击切换模式'
            : '按需审批\n危险操作会弹出确认\n点击切换模式'
        }
        className={cn(approvalMode === 'auto' && 'text-warning')}
        onClick={() => void toggleApprovalMode()}
      >
        <Zap />
      </Button>

      <ThinkingControl />

      <AttachControl />

      <div className="mx-1 flex-1" />

      <ContextUsageRing />

      <ModelPicker />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="发送"
        title="发送（Enter）"
        disabled={!canSend}
        className={cn('ml-0.5', !canSend && 'opacity-40')}
        onClick={onSend}
      >
        <CornerDownLeft />
      </Button>
    </div>
  )
}

/** 思考深度：弹层内用滑块选择档位 */
function ThinkingControl(): JSX.Element {
  const [open, setOpen] = useState(false)
  const level = useComposerStore((s) => s.thinkingLevel)
  const levels = useComposerStore((s) => s.availableThinkingLevels)
  const setThinkingLevel = useComposerStore((s) => s.setThinkingLevel)

  const index = Math.max(0, levels.indexOf(level))
  const active = levels.length > 0

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="思考深度"
        title={active ? `思考深度：${thinkingLabel(level)}` : '思考深度'}
        disabled={!active}
        onClick={() => setOpen((value) => !value)}
      >
        <Brain />
      </Button>
      {open && active && (
        <Popover onClose={() => setOpen(false)} className="w-56">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>思考深度</span>
            <span className="text-foreground">{thinkingLabel(level)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={levels.length - 1}
            step={1}
            value={index}
            className="w-full accent-primary"
            onChange={(event) => void setThinkingLevel(levels[Number(event.target.value)])}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            {levels.map((item) => (
              <span key={item} className={cn(item === level && 'text-foreground')}>
                {thinkingLabel(item)}
              </span>
            ))}
          </div>
        </Popover>
      )}
    </div>
  )
}

/** 附件：菜单选择文件或文件夹，选中项显示为 chip */
function AttachControl(): JSX.Element {
  const [open, setOpen] = useState(false)
  const attachments = useComposerStore((s) => s.attachments)
  const addAttachments = useComposerStore((s) => s.addAttachments)
  const removeAttachment = useComposerStore((s) => s.removeAttachment)

  return (
    <div className="relative flex min-w-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="附加文件或文件夹"
        title="附加文件或文件夹"
        onClick={() => setOpen((value) => !value)}
      >
        <Paperclip />
      </Button>

      {attachments.length > 0 && (
        <div className="flex min-w-0 max-w-[46%] items-center gap-1 overflow-x-auto">
          {attachments.map((path) => (
            <span
              key={path}
              title={path}
              className="flex shrink-0 items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-foreground"
            >
              <span className="max-w-[10rem] truncate">{basenameOf(path)}</span>
              <button
                type="button"
                aria-label={`移除 ${path}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeAttachment(path)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <Popover onClose={() => setOpen(false)} className="w-36 p-1">
          <MenuItem
            onClick={() => {
              setOpen(false)
              void addAttachments('file')
            }}
          >
            附加文件…
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false)
              void addAttachments('folder')
            }}
          >
            附加文件夹…
          </MenuItem>
        </Popover>
      )}
    </div>
  )
}

/** 上下文用量环 */
function ContextUsageRing(): JSX.Element {
  const usage = useComposerStore((s) => s.contextUsage)
  const percent = usage?.percent ?? null
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const ratio = percent === null ? 0 : Math.min(1, Math.max(0, percent / 100))

  const title = usage
    ? percent !== null
      ? `上下文用量：${percent.toFixed(0)}%（${usage.tokens ?? '?'} / ${usage.contextWindow} tokens）`
      : `上下文用量：未知（窗口 ${usage.contextWindow} tokens）`
    : '上下文用量：暂无数据'

  return (
    <span
      title={title}
      aria-label={title}
      className="flex size-7 items-center justify-center text-muted-foreground"
    >
      <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90">
        <circle cx="8" cy="8" r={radius} className="fill-none stroke-border" strokeWidth="2" />
        {percent !== null && (
          <circle
            cx="8"
            cy="8"
            r={radius}
            className={cn('fill-none', ratio > 0.85 ? 'stroke-warning' : 'stroke-primary')}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
          />
        )}
      </svg>
    </span>
  )
}

/** 模型选择器：可搜索 + 切换 */
function ModelPicker(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const models = useComposerStore((s) => s.models)
  const providerId = useComposerStore((s) => s.providerId)
  const modelId = useComposerStore((s) => s.modelId)
  const setModel = useComposerStore((s) => s.setModel)

  const label = modelLabelOf({ models, providerId, modelId })

  const grouped = useMemo(() => {
    const filter = keyword.trim().toLowerCase()
    const matched = models.filter((model) =>
      filter
        ? `${model.providerId} ${model.name} ${model.id}`.toLowerCase().includes(filter)
        : true
    )
    const map = new Map<string, typeof matched>()
    for (const model of matched) {
      const list = map.get(model.providerId) ?? []
      list.push(model)
      map.set(model.providerId, list)
    }
    return [...map.entries()]
  }, [models, keyword])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px]"
        aria-label="选择模型"
        title="选择模型"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Zap className="size-2.5" />
        </span>
        <span className="max-w-[13rem] truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </Button>

      {open && (
        <Popover onClose={() => setOpen(false)} className="right-0 w-72 p-0">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={keyword}
                placeholder="搜索模型…"
                className="h-7 border-0 bg-transparent px-0 focus-visible:ring-0"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {models.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                没有可用模型：尚未为任何 provider 配置凭证
              </p>
            ) : grouped.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">没有匹配的模型</p>
            ) : (
              grouped.map(([provider, list]) => (
                <div key={provider} className="mb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {list[0]?.providerName ?? provider}
                  </div>
                  {list.map((model) => {
                    const selected = model.providerId === providerId && model.id === modelId
                    return (
                      <button
                        key={`${model.providerId}/${model.id}`}
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          if (!selected) void setModel(model.providerId, model.id)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{model.name}</span>
                        {selected && <Check className="size-3.5 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
          {models.length > 0 && (
            <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              仅列出已配置凭证的模型
            </p>
          )}
        </Popover>
      )}
    </div>
  )
}

/** 向上弹出的浮层，点击外部或 Esc 关闭 */
function Popover({
  onClose,
  className,
  children
}: {
  onClose: () => void
  className?: string
  children: ReactNode
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'absolute bottom-full z-50 mb-2 overflow-hidden rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg',
        className
      )}
    >
      {children}
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
    >
      {children}
    </button>
  )
}

/** 取路径最后一段，用于附件 chip */
function basenameOf(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
}
