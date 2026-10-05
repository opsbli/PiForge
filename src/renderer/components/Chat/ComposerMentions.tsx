import { File, Folder, History, type LucideIcon, Plug, Sparkles } from 'lucide-react'
import type { JSX } from 'react'
import { MENTION_META, type MentionItem, type MentionKind } from '@renderer/lib/composer-references'
import { cn } from '@renderer/lib/utils'

const KIND_ICON: Record<MentionKind, LucideIcon> = {
  '@': File,
  '/': Sparkles,
  '#': Plug,
  '&': History
}

/** 引用候选弹层：浮在输入框上方，键盘上下选择、Enter 插入 */
export function MentionPopup({
  kind,
  items,
  activeIndex,
  onPick,
  onHover
}: {
  kind: MentionKind
  items: MentionItem[]
  activeIndex: number
  onPick: (item: MentionItem) => void
  onHover: (index: number) => void
}): JSX.Element {
  const meta = MENTION_META[kind]
  const TriggerIcon = KIND_ICON[kind]

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(30rem,100%)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <TriggerIcon className="size-3.5" />
        <span>{meta.title}</span>
        <span className="ml-auto text-[10px] opacity-70">
          ↑↓ 选择 · Enter 插入 · Esc 关闭
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">{meta.empty}</p>
      ) : (
        <div className="max-h-64 overflow-y-auto p-1">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => onHover(index)}
              onClick={() => onPick(item)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
              )}
            >
              <span className="shrink-0 text-muted-foreground">
                {kind === '@' && item.hint === '文件夹' ? (
                  <Folder className="size-3.5" />
                ) : (
                  <TriggerIcon className="size-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && (
                <span className="max-w-[45%] shrink-0 truncate text-[10px] text-muted-foreground">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
