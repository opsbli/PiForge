import { useEffect, useState, type JSX } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Info,
  Layers,
  Package,
  Plug,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SettingsScopeName } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Segmented, type SegmentedOption } from '@renderer/components/ui/segmented'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'
import { NoticeBlock } from './SettingsLayout'
import { SettingsConfirmDialog } from './SettingsConfirmDialog'
import { AboutSection } from './sections/AboutSection'
import { ContextSection } from './sections/ContextSection'
import { ExtensionsSection } from './sections/ExtensionsSection'
import { GeneralSection } from './sections/GeneralSection'
import { McpSection } from './sections/McpSection'
import { ModelSection } from './sections/ModelSection'
import { PackagesSection } from './sections/PackagesSection'
import { SkillsSection } from './sections/SkillsSection'
import { ToolsSection } from './sections/ToolsSection'
import { TrustSection } from './sections/TrustSection'

type SectionId =
  | 'general'
  | 'model'
  | 'tools'
  | 'context'
  | 'extensions'
  | 'packages'
  | 'skills'
  | 'mcp'
  | 'trust'
  | 'about'

const SECTIONS: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: 'general', label: '通用', icon: SlidersHorizontal },
  { id: 'model', label: '模型', icon: Sparkles },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'context', label: '会话与上下文', icon: Layers },
  { id: 'extensions', label: '扩展', icon: Puzzle },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'skills', label: 'Skill', icon: BookOpen },
  { id: 'mcp', label: 'MCP', icon: Plug },
  { id: 'trust', label: '项目与信任', icon: ShieldCheck },
  { id: 'about', label: '关于', icon: Info }
]

const SCOPE_OPTIONS: SegmentedOption<SettingsScopeName>[] = [
  { value: 'global', label: '用户级', title: '写入 agent 目录的 settings.json' },
  { value: 'project', label: '项目级', title: '写入 .pi/settings.json' }
]

/** 中栏设置视图：左侧分类导航 + 右侧内容区 + 顶部写入栏 */
export function SettingsView({ onExit }: { onExit: () => void }): JSX.Element {
  const [active, setActive] = useState<SectionId>('general')

  const settings = useSettingsStore((s) => s.settings)
  const trust = useSettingsStore((s) => s.trust)
  const load = useSettingsStore((s) => s.load)
  const loading = useSettingsStore((s) => s.loading)
  const unavailable = useSettingsStore((s) => s.unavailable)
  const error = useSettingsStore((s) => s.error)

  const scope = useSettingsStore((s) => s.scope)
  const setScope = useSettingsStore((s) => s.setScope)
  const draft = useSettingsStore((s) => s.draft)
  const requestSave = useSettingsStore((s) => s.requestSave)
  const resetDraft = useSettingsStore((s) => s.resetDraft)
  const lastWrite = useSettingsStore((s) => s.lastWrite)
  const dismissResult = useSettingsStore((s) => s.dismissResult)
  const reloadAgent = useSettingsStore((s) => s.reloadAgent)

  useEffect(() => {
    void load()
  }, [load])

  const draftCount = Object.keys(draft).length
  const projectUntrusted = scope === 'project' && trust !== null && !trust.loaderTrusted

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft />
          返回工作台
        </Button>
        <span className="text-xs font-medium text-foreground">设置</span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">写入目标</span>
          <Segmented value={scope} onValueChange={setScope} options={SCOPE_OPTIONS} />
          {draftCount > 0 && (
            <>
              <span className="text-[11px] text-warning">{draftCount} 项待保存</span>
              <Button variant="ghost" size="sm" onClick={resetDraft}>
                放弃
              </Button>
              <Button variant="default" size="sm" onClick={requestSave}>
                保存…
              </Button>
            </>
          )}
          {loading && <span className="text-[11px] text-muted-foreground">读取中…</span>}
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw />
            重新读取
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const isActive = section.id === active
            return (
              <button
                key={section.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActive(section.id)}
                className={cn(
                  'flex h-7 select-none items-center gap-2 rounded-md px-2 text-left text-xs transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {error && <NoticeBlock tone="warning">{error}</NoticeBlock>}
          {unavailable && (
            <NoticeBlock tone="warning">
              agent 尚未就绪，快照暂时不可用。稍后点右上角「重新读取」。
            </NoticeBlock>
          )}
          {projectUntrusted && (
            <NoticeBlock tone="warning">
              当前项目未被信任，项目级写入会被拒绝。可到「项目与信任」查看原因。
            </NoticeBlock>
          )}
          {lastWrite && lastWrite.needsReload.length > 0 && (
            <NoticeBlock tone="warning">
              <div className="flex items-start justify-between gap-3">
                <span>
                  已写入 {lastWrite.needsReload.length} 项需要重载 agent 才生效：
                  <span className="ml-1 font-mono">{lastWrite.needsReload.join('、')}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={() => void reloadAgent()}>
                    立即重载
                  </Button>
                  <Button variant="ghost" size="sm" onClick={dismissResult}>
                    知道了
                  </Button>
                </span>
              </div>
            </NoticeBlock>
          )}
          {lastWrite && lastWrite.needsReload.length === 0 && lastWrite.appliedLive.length > 0 && (
            <NoticeBlock>
              <div className="flex items-center justify-between gap-3">
                <span>
                  已写入并立即生效：
                  <span className="ml-1 font-mono">{lastWrite.appliedLive.join('、')}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={dismissResult}>
                  知道了
                </Button>
              </div>
            </NoticeBlock>
          )}

          {renderSection(active)}
        </div>
      </div>

      <SettingsConfirmDialog />
    </div>
  )
}

function renderSection(id: SectionId): JSX.Element {
  switch (id) {
    case 'general':
      return <GeneralSection />
    case 'model':
      return <ModelSection />
    case 'tools':
      return <ToolsSection />
    case 'context':
      return <ContextSection />
    case 'extensions':
      return <ExtensionsSection />
    case 'packages':
      return <PackagesSection />
    case 'skills':
      return <SkillsSection />
    case 'mcp':
      return <McpSection />
    case 'trust':
      return <TrustSection />
    case 'about':
      return <AboutSection />
  }
}
