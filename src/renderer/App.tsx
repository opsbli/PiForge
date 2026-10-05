import { useEffect, useState, type JSX } from 'react'
import { FileTree } from '@renderer/components/FileTree/FileTree'
import { Editor } from '@renderer/components/Editor/Editor'
import { TerminalPanel } from '@renderer/components/Terminal/TerminalPanel'
import { ChatPanel } from '@renderer/components/Chat/ChatPanel'
import { ApprovalDialog } from '@renderer/components/Approval/ApprovalDialog'
import { SettingsDialog } from '@renderer/components/Settings/SettingsDialog'
import { SessionList } from '@renderer/components/SessionTree/SessionList'
import { CostDashboard } from '@renderer/components/Cost/CostDashboard'
import { useApprovalStore } from '@renderer/stores/approval-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

export default function App(): JSX.Element {
  const setPending = useApprovalStore((s) => s.setPending)
  const workspace = useWorkspaceStore((s) => s.workspace)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  // 订阅危险操作审批请求
  useEffect(() => {
    const off = window.piforge.onApprovalRequest(setPending)
    return off
  }, [setPending])

  // 启动时读取当前工作区
  useEffect(() => {
    void window.piforge.getWorkspace().then(setWorkspace)
  }, [setWorkspace])

  const openFolder = async (): Promise<void> => {
    const selected = await window.piforge.selectWorkspace()
    if (selected) setWorkspace(selected)
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">PiForge Desktop</h1>
          <button
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
            onClick={() => void openFolder()}
          >
            打开文件夹
          </button>
          <span
            className="max-w-[300px] truncate text-xs text-muted-foreground"
            title={workspace ?? ''}
          >
            {workspace ?? '未选择工作区'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CostDashboard />
          <button
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
            onClick={() => setSessionsOpen(true)}
          >
            会话
          </button>
          <button
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
            onClick={() => setSettingsOpen(true)}
          >
            设置
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 border-r border-border">
          <FileTree />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Editor />
          </div>
          <div className="h-56 shrink-0 border-t border-border">
            <TerminalPanel />
          </div>
        </main>

        <aside className="w-96 shrink-0 border-l border-border">
          <ChatPanel />
        </aside>
      </div>

      <ApprovalDialog />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SessionList open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </div>
  )
}
