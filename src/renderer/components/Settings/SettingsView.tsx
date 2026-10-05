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
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'
import { NoticeBlock } from './SettingsLayout'
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

/** 中栏设置视图：左侧分类导航 + 右侧内容区 */
export function SettingsView({ onExit }: { onExit: () => void }): JSX.Element {
  const [active, setActive] = useState<SectionId>('general')
  const load = useSettingsStore((s) => s.load)
  const loading = useSettingsStore((s) => s.loading)
  const unavailable = useSettingsStore((s) => s.unavailable)
  const error = useSettingsStore((s) => s.error)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft />
          返回工作台
        </Button>
        <span className="text-xs font-medium text-foreground">设置</span>
        <div className="ml-auto flex items-center gap-2">
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
          {error && <NoticeBlock tone="warning">读取失败：{error}</NoticeBlock>}
          {unavailable && (
            <NoticeBlock tone="warning">
              agent 尚未就绪，快照暂时不可用。稍后点右上角「重新读取」。
            </NoticeBlock>
          )}
          {renderSection(active)}
        </div>
      </div>
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
