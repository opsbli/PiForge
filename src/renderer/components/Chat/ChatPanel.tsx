import { useEffect, useRef, useState, type JSX } from 'react'
import { Paperclip, ScrollText, Sparkles, User } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import { MarkdownText } from '@renderer/components/Chat/MarkdownText'
import { ComposerToolbar } from '@renderer/components/Chat/ComposerToolbar'
import { MentionPopup } from '@renderer/components/Chat/ComposerMentions'
import { ToolCallCard } from '@renderer/components/ToolCall/ToolCallCard'
import { useChatStore, type ChatMessage } from '@renderer/stores/chat-store'
import { useComposerStore } from '@renderer/stores/composer-store'
import {
  buildMentionItems,
  buildReferenceBlock,
  findMentionTrigger,
  type MentionItem,
  type MentionTrigger
} from '@renderer/lib/composer-references'

/** 中栏「对话」视图：消息流 + 输入区 */
export function ChatPanel({ active = true }: { active?: boolean }): JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const addUserMessage = useChatStore((s) => s.addUserMessage)
  const handleAgentEvent = useChatStore((s) => s.handleAgentEvent)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 订阅 Agent 事件
  useEffect(() => {
    const off = window.piforge.onAgentEvent(handleAgentEvent)
    return off
  }, [handleAgentEvent])

  // 自动滚到底部（视图被隐藏时不滚，重新激活时补滚）
  useEffect(() => {
    if (!active) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, active])

  const send = async (text: string): Promise<void> => {
    addUserMessage(text)
    await window.piforge.sendPrompt(text)
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <EmptyHint />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      <Composer disabled={streaming} onSend={(text) => void send(text)} />
    </div>
  )
}

function EmptyHint(): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-muted-foreground">
        <Sparkles className="size-4" />
      </span>
      <p className="text-xs text-muted-foreground">输入一条 prompt 开始（当前接入 DeepSeek 真实模型）</p>
    </div>
  )
}

function MessageRow({ message }: { message: ChatMessage }): JSX.Element {
  if (message.role === 'tool') {
    return <ToolCallCard message={message} />
  }

  // 摘要：虚框 + 警告色浅底，与工具卡片、正文都不同
  if (message.role === 'note') {
    return (
      <div className="flex gap-2.5">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <ScrollText className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-medium text-warning">{message.title}</div>
          <div className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2">
            <MarkdownText text={message.text} />
          </div>
        </div>
      </div>
    )
  }

  // 用户：右对齐实底气泡
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 pr-1 text-[10px] font-medium text-muted-foreground">
          <User className="size-3" />
          你
        </div>
        <div className="max-w-[85%] rounded-xl rounded-br-sm border border-border/60 bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        </div>
      </div>
    )
  }

  // 助手：左对齐、无休口背景，用左侧色轨 + 角色标签区分
  return (
    <div className="flex gap-2.5">
      <div aria-hidden className="w-0.5 shrink-0 rounded-full bg-info/50" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <Sparkles className="size-3 text-info" />
          助手
          {message.streaming && <span className="text-info">生成中…</span>}
        </div>
        {message.text ? (
          <MarkdownText text={message.text} />
        ) : (
          <p className="text-xs text-muted-foreground">思考中…</p>
        )}
        {message.streaming && (
          <span className="mt-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
        )}
      </div>
    </div>
  )
}

function Composer({
  disabled,
  onSend
}: {
  disabled: boolean
  onSend: (text: string) => void
}): JSX.Element {
  const [value, setValue] = useState('')
  const [mention, setMention] = useState<MentionTrigger | null>(null)
  const [items, setItems] = useState<MentionItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const attachments = useComposerStore((s) => s.attachments)
  const addPaths = useComposerStore((s) => s.addPaths)
  const removeAttachment = useComposerStore((s) => s.removeAttachment)
  const clearAttachments = useComposerStore((s) => s.clearAttachments)

  // 随内容自适应高度（上限 160px，超出后内部滚动）
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`
  }, [value])

  // 引用候选（@ 走文件搜索，需防抖）
  useEffect(() => {
    if (!mention) {
      setItems([])
      setActiveIndex(0)
      return
    }
    const timer = window.setTimeout(
      () => {
        void buildMentionItems(mention.kind, mention.query).then((next) => {
          setItems(next)
          setActiveIndex(0)
        })
      },
      mention.kind === '@' ? 120 : 0
    )
    return () => window.clearTimeout(timer)
  }, [mention])

  const open = mention !== null && !disabled

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0)

  const syncMention = (text: string, caret: number): void => {
    setMention(findMentionTrigger(text, caret))
  }

  const insertMention = (item: MentionItem): void => {
    if (!mention) return
    const caret = textareaRef.current?.selectionStart ?? value.length

    // @ 引用文件：与 📎 保持一致，只加输入框内部的 chip，不在正文里留标记
    if (mention.kind === '@' && item.payload) {
      const next = `${value.slice(0, mention.start)}${value.slice(caret)}`
      const position = mention.start
      setValue(next)
      setMention(null)
      addPaths([item.payload])
      window.requestAnimationFrame(() => {
        const element = textareaRef.current
        if (!element) return
        element.focus()
        element.setSelectionRange(position, position)
      })
      return
    }

    const next = `${value.slice(0, mention.start)}${mention.kind}${item.insert} ${value.slice(caret)}`
    const position = mention.start + 1 + item.insert.length + 1
    setValue(next)
    setMention(null)
    window.requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) return
      element.focus()
      element.setSelectionRange(position, position)
    })
  }

  const submit = async (): Promise<void> => {
    if (!canSend) return
    const text = value.trim()
    // 把 @ / # & 标记与附件解析成引用块，随消息一起交给模型
    const block = await buildReferenceBlock(text, attachments)
    const payload = block ? `${text}${text ? '\n\n' : ''}${block}` : text
    onSend(payload)
    setValue('')
    setMention(null)
    clearAttachments()
  }

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="rounded-lg border border-border bg-card transition-colors focus-within:border-ring">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 pt-2">
            {attachments.map((path) => (
              <span
                key={path}
                title={path}
                className="flex max-w-[16rem] items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-foreground"
              >
                <Paperclip className="size-2.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{basenameOf(path)}</span>
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

        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={
              disabled
                ? '正在生成…'
                : '输入消息…（@ 引用文件，/ 调用 Skill，# 使用 MCP，& 引用会话；Enter 发送）'
            }
            className="max-h-40 border-0 bg-transparent px-3 py-2 focus-visible:ring-0"
            onChange={(event) => {
              const next = event.target.value
              setValue(next)
              syncMention(next, event.target.selectionStart ?? next.length)
            }}
            onClick={(event) =>
              syncMention(value, (event.target as HTMLTextAreaElement).selectionStart ?? value.length)
            }
            onKeyDown={(event) => {
              if (open && items.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((index) => (index + 1) % items.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((index) => (index - 1 + items.length) % items.length)
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  insertMention(items[activeIndex])
                  return
                }
              }
              if (event.key === 'Escape' && open) {
                event.preventDefault()
                setMention(null)
                return
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
          />

          {open && mention && (
            <MentionPopup
              kind={mention.kind}
              items={items}
              activeIndex={activeIndex}
              onPick={insertMention}
              onHover={setActiveIndex}
            />
          )}
        </div>

        <ComposerToolbar canSend={canSend} onSend={() => void submit()} />
      </div>
    </div>
  )
}

/** 取路径最后一段，用于附件 chip */
function basenameOf(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
}
