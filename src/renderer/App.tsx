import { useEffect, useState, type JSX } from 'react'
import { ResizeHandle } from '@renderer/components/ui/resize-handle'
import { TitleBar } from '@renderer/components/layout/TitleBar'
import { Sidebar } from '@renderer/components/layout/Sidebar'
import { CenterStage } from '@renderer/components/layout/CenterStage'
import { RightPanel } from '@renderer/components/layout/RightPanel'
import { ApprovalDialog } from '@renderer/components/Approval/ApprovalDialog'
import { MemoryPanel } from '@renderer/components/Memory/MemoryPanel'
import { SessionTree } from '@renderer/components/SessionTree/SessionTree'
import { TracePanel } from '@renderer/components/Trace/TracePanel'
import { useApprovalStore } from '@renderer/stores/approval-store'
import { useComposerStore } from '@renderer/stores/composer-store'
import { useCostStore } from '@renderer/stores/cost-store'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useProfileStore } from '@renderer/stores/profile-store'
import { useProjectsStore } from '@renderer/stores/projects-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

export default function App(): JSX.Element {
  const setPending = useApprovalStore((s) => s.setPending)
  const newSession = useCostStore((s) => s.newSession)

  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const rightPanelOpen = useLayoutStore((s) => s.rightPanelOpen)
  const resizeSidebar = useLayoutStore((s) => s.resizeSidebar)
  const resetSidebarWidth = useLayoutStore((s) => s.resetSidebarWidth)
  const resizeRightPanel = useLayoutStore((s) => s.resizeRightPanel)
  const resetRightPanelWidth = useLayoutStore((s) => s.resetRightPanelWidth)

  const [memoryOpen, setMemoryOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)

  // 订阅危险操作审批请求
  useEffect(() => {
    const off = window.piforge.onApprovalRequest(setPending)
    return off
  }, [setPending])

  // 启动时载入项目列表（同时同步工作区、会话列表与成本摘要）
  useEffect(() => {
    void useProjectsStore.getState().load()
  }, [])

  // 启动时载入本机个人资料（头像 / 昵称）
  useEffect(() => {
    void useProfileStore.getState().load()
  }, [])

  // 启动时载入输入框工具栏状态（审批模式 / 思考档位 / 模型 / 上下文用量）
  useEffect(() => {
    void useComposerStore.getState().load()
  }, [])

  // Ctrl/Cmd+N 新建会话（未选工作区时不响应）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        if (!useWorkspaceStore.getState().workspace) return
        event.preventDefault()
        void newSession()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [newSession])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {!sidebarCollapsed && (
          <>
            <Sidebar
              onOpenSessionTree={() => setTreeOpen(true)}
              onOpenMemory={() => setMemoryOpen(true)}
              onOpenTrace={() => setTraceOpen(true)}
            />
            <ResizeHandle onDrag={resizeSidebar} onReset={resetSidebarWidth} />
          </>
        )}

        <CenterStage />

        {rightPanelOpen && (
          <>
            <ResizeHandle
              onDrag={(delta) => resizeRightPanel(-delta)}
              onReset={resetRightPanelWidth}
            />
            <RightPanel />
          </>
        )}
      </div>

      <ApprovalDialog />
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <SessionTree open={treeOpen} onClose={() => setTreeOpen(false)} />
      <TracePanel open={traceOpen} onClose={() => setTraceOpen(false)} />
    </div>
  )
}
