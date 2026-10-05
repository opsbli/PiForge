import type { JSX, ReactNode } from 'react'
import { FileClock, FileText, RefreshCw, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Segmented, type SegmentedOption } from '@renderer/components/ui/segmented'
import { FileTree } from '@renderer/components/FileTree/FileTree'
import { useLayoutStore, type RightTab } from '@renderer/stores/layout-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { basename } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

const TAB_OPTIONS: SegmentedOption<RightTab>[] = [
  { value: 'files', label: '文件', icon: FileText },
  { value: 'changes', label: '改动', icon: FileClock }
]

/** 右栏：文件树 / 本地改动。两个面板都保活，避免切换时丢失展开状态 */
export function RightPanel(): JSX.Element {
  const width = useLayoutStore((s) => s.rightPanelWidth)
  const rightTab = useLayoutStore((s) => s.rightTab)
  const setRightTab = useLayoutStore((s) => s.setRightTab)
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel)
  const refreshTree = useWorkspaceStore((s) => s.refreshTree)

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-hidden bg-panel"
      style={{ width }}
    >
      <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <Segmented value={rightTab} onValueChange={setRightTab} options={TAB_OPTIONS} />
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="刷新文件树"
            title="刷新文件树"
            onClick={refreshTree}
          >
            <RefreshCw />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="收起面板"
            title="收起面板"
            onClick={toggleRightPanel}
          >
            <X />
          </Button>
        </div>
      </header>

      <div className={cn('min-h-0 flex-1', rightTab !== 'files' && 'hidden')}>
        <FileTree />
      </div>
      <div className={cn('min-h-0 flex-1', rightTab !== 'changes' && 'hidden')}>
        <ChangesPanel />
      </div>
    </aside>
  )
}

/**
 * 「本地改动」视图：未保存文件 + 最近打开的文件。
 *
 * 说明：PiForge 目前没有 git 相关 IPC，所以这里不是 git diff，
 * 只呈现会话内的本地改动；接入 git 后可直接替换本面板的数据源。
 */
function ChangesPanel(): JSX.Element {
  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const dirty = useWorkspaceStore((s) => s.dirty)
  const recentFiles = useWorkspaceStore((s) => s.recentFiles)
  const openFile = useWorkspaceStore((s) => s.openFile)
  const setMainView = useLayoutStore((s) => s.setMainView)

  const openInEditor = async (path: string): Promise<void> => {
    try {
      openFile(path, await window.piforge.readFile(path))
      setMainView('editor')
    } catch (err) {
      window.alert(`打开失败：${String(err)}`)
    }
  }

  const unsaved = openFilePath && dirty ? [openFilePath] : []
  const recents = recentFiles.filter((path) => !unsaved.includes(path))

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-1 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          会话内的本地改动视图（尚未接入 git diff）
        </p>

        <Section title="未保存" empty="没有未保存的文件" isEmpty={unsaved.length === 0}>
          {unsaved.map((path) => (
            <FileRow
              key={path}
              path={path}
              hint="未保存"
              tone="warning"
              onClick={() => void openInEditor(path)}
            />
          ))}
        </Section>

        <Section title="最近打开" empty="还没有打开过文件" isEmpty={recents.length === 0}>
          {recents.map((path) => (
            <FileRow key={path} path={path} onClick={() => void openInEditor(path)} />
          ))}
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  empty,
  isEmpty,
  children
}: {
  title: string
  empty: string
  isEmpty: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <div className="mb-3">
      <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {isEmpty ? (
        <p className="px-1 py-1 text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </div>
  )
}

function FileRow({
  path,
  hint,
  tone = 'neutral',
  onClick
}: {
  path: string
  hint?: string
  tone?: 'neutral' | 'warning'
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={path}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent"
    >
      <span className="min-w-0 flex-1 truncate text-xs">{basename(path)}</span>
      {hint && (
        <span
          className={cn(
            'shrink-0 text-[10px]',
            tone === 'warning' ? 'text-warning' : 'text-muted-foreground'
          )}
        >
          {hint}
        </span>
      )}
    </button>
  )
}
