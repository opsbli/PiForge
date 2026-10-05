import { useEffect, useRef, useState, type JSX } from 'react'
import { Sparkles, SendHorizontal, User } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import { MarkdownText } from '@renderer/components/Chat/MarkdownText'
import { ToolCallCard } from '@renderer/components/ToolCall/ToolCallCard'
import { useChatStore, type ChatMessage } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'

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

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <User className="size-3" />
            你
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
        <Sparkles className="size-3" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {message.text ? (
          <MarkdownText text={message.text} />
        ) : (
          <p className="text-xs text-muted-foreground">思考中…</p>
        )}
        {message.streaming && (
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 随内容自适应高度（上限 160px，超出后内部滚动）
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`
  }, [value])

  const canSend = !disabled && value.trim().length > 0

  const submit = (): void => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="rounded-lg border border-border bg-card transition-colors focus-within:border-ring">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? '正在生成…' : '输入 prompt，Enter 发送，Shift+Enter 换行'}
          className="max-h-40 border-0 bg-transparent px-3 py-2 focus-visible:ring-0"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="truncate text-[10px] text-muted-foreground">
            Enter 发送 · Shift+Enter 换行
          </span>
          <Button
            size="sm"
            variant="default"
            className={cn(!canSend && 'opacity-50')}
            disabled={!canSend}
            onClick={submit}
          >
            <SendHorizontal />
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
