import { useEffect, useRef, useState, type JSX } from 'react'
import { useChatStore, type ChatMessage } from '@renderer/stores/chat-store'
import { ToolCallCard } from '@renderer/components/ToolCall/ToolCallCard'

export function ChatPanel(): JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const addUserMessage = useChatStore((s) => s.addUserMessage)
  const handleAgentEvent = useChatStore((s) => s.handleAgentEvent)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 订阅 Agent 事件
  useEffect(() => {
    const off = window.piforge.onAgentEvent(handleAgentEvent)
    return off
  }, [handleAgentEvent])

  // 自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || streaming) return
    addUserMessage(text)
    setInput('')
    await window.piforge.sendPrompt(text)
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            输入一条 prompt 开始（当前接入 DeepSeek 真实模型）
          </p>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            value={input}
            placeholder={streaming ? '正在生成…' : '输入 prompt，回车发送'}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send()
            }}
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={streaming}
            onClick={() => void send()}
          >
            发送
          </button>
        </div>
      </div>
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
        <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-card px-3 py-2 text-sm text-card-foreground">
      {message.text}
      {message.streaming && <span className="ml-1 inline-block animate-pulse">▍</span>}
    </div>
  )
}
