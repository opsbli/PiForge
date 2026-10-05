import { useEffect, useState, type JSX } from 'react'
import { ChatPanel } from '@renderer/components/Chat/ChatPanel'
import { ApprovalDialog } from '@renderer/components/Approval/ApprovalDialog'
import { SettingsDialog } from '@renderer/components/Settings/SettingsDialog'
import { useApprovalStore } from '@renderer/stores/approval-store'

export default function App(): JSX.Element {
  const setPending = useApprovalStore((s) => s.setPending)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 订阅危险操作审批请求
  useEffect(() => {
    const off = window.piforge.onApprovalRequest(setPending)
    return off
  }, [setPending])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">PiForge Desktop</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">deepseek-flash</span>
          <button
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
            onClick={() => setSettingsOpen(true)}
          >
            设置
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <ChatPanel />
      </main>

      <ApprovalDialog />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
