import type { JSX } from 'react'
import { ChatPanel } from '@renderer/components/Chat/ChatPanel'

export default function App(): JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">PiForge Desktop</h1>
        <span className="text-xs text-muted-foreground">deepseek-flash</span>
      </header>

      <main className="min-h-0 flex-1">
        <ChatPanel />
      </main>
    </div>
  )
}
