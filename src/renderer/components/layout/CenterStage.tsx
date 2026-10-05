import type { JSX, ReactNode } from 'react'
import { Code, MessageSquare, PanelRight, Terminal as TerminalIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Segmented, type SegmentedOption } from '@renderer/components/ui/segmented'
import { Tooltip } from '@renderer/components/ui/tooltip'
import { ChatPanel } from '@renderer/components/Chat/ChatPanel'
import { CostDashboard } from '@renderer/components/Cost/CostDashboard'
import { Editor } from '@renderer/components/Editor/Editor'
import { TerminalPanel } from '@renderer/components/Terminal/TerminalPanel'
import { useCostStore } from '@renderer/stores/cost-store'
import { useLayoutStore, type MainView } from '@renderer/stores/layout-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { basename } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

const VIEW_OPTIONS: SegmentedOption<MainView>[] = [
  { value: 'chat', label: '对话', icon: MessageSquare },
  { value: 'editor', label: '编辑器', icon: Code },
  { value: 'terminal', label: '终端', icon: TerminalIcon }
]

/** 中栏工作台：视图切换 + 当前视图标题 + 会话成本 + 右侧面板开关 */
export function CenterStage(): JSX.Element {
  const mainView = useLayoutStore((s) => s.mainView)
  const setMainView = useLayoutStore((s) => s.setMainView)
  const rightPanelOpen = useLayoutStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel)

  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const sessions = useCostStore((s) => s.sessions)
  const summary = useCostStore((s) => s.summary)

  const activeSession = sessions.find((item) => item.id === summary?.sessionId)
  const sessionTitle =
    activeSession?.name?.trim() || activeSession?.firstMessage?.trim() || '当前会话'

  const title =
    mainView === 'chat'
      ? sessionTitle
      : mainView === 'editor'
        ? openFilePath
          ? basename(openFilePath)
          : '未打开文件'
        : '本地终端'

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-panel">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-2">
        <Segmented value={mainView} onValueChange={setMainView} options={VIEW_OPTIONS} />
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={title}>
          {title}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CostDashboard />
          <Tooltip label={rightPanelOpen ? '收起文件面板' : '展开文件面板'} side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="切换文件面板"
              onClick={toggleRightPanel}
            >
              <PanelRight />
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ViewSlot visible={mainView === 'chat'}>
          <ChatPanel active={mainView === 'chat'} />
        </ViewSlot>
        <ViewSlot visible={mainView === 'editor'}>
          <Editor active={mainView === 'editor'} />
        </ViewSlot>
        <ViewSlot visible={mainView === 'terminal'}>
          <TerminalPanel active={mainView === 'terminal'} />
        </ViewSlot>
      </div>
    </main>
  )
}

/**
 * 保活视图槽：非当前视图用 hidden 隐藏而非卸载。
 * 终端持有 PTY 会话、编辑器持有 Monaco 实例，卸载会直接销毁它们。
 */
function ViewSlot({ visible, children }: { visible: boolean; children: ReactNode }): JSX.Element {
  return <div className={cn('absolute inset-0', !visible && 'hidden')}>{children}</div>
}
