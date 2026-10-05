import { useEffect, useState, type JSX } from 'react'

export default function App(): JSX.Element {
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<string[]>([])

  // 订阅 Agent 事件流（阶段二为 mock 数据）
  useEffect(() => {
    const off = window.piforge.onAgentEvent((event) => {
      if (event.type === 'message_delta') {
        setLines((prev) => [...prev, event.text])
      } else if (event.type === 'turn_end') {
        setLines((prev) => [...prev, '--- turn end ---'])
      } else if (event.type === 'error') {
        setLines((prev) => [...prev, `[error] ${event.message}`])
      }
    })
    return off
  }, [])

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text) return
    setLines((prev) => [...prev, `> ${text}`])
    setInput('')
    await window.piforge.sendPrompt(text)
  }

  // 阶段二验证用：在 DevTools 控制台打印安全边界
  useEffect(() => {
    const w = window as unknown as { require?: unknown; process?: unknown }
    console.log('[verify] typeof require =', typeof w.require)
    console.log('[verify] typeof process =', typeof w.process)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">PiForge Desktop（阶段二 · mock）</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 font-mono text-sm">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">输入一条 prompt 试试（当前返回 mock 数据）</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
      </main>

      <footer className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={input}
            placeholder="输入 prompt，回车发送"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSend()
            }}
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => void handleSend()}
          >
            发送
          </button>
        </div>
      </footer>
    </div>
  )
}
