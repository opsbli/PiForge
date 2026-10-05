import type { JSX } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow
} from '../SettingsLayout'

/** Pi packages：npm / git / 本地目录形式的资源包 */
export function PackagesSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resolved = settings?.resolved

  const userPackages = resolved?.packages ?? []
  const projectPackages = toSourceList(settings?.project.packages)

  return (
    <SectionShell
      title="Packages"
      description="一个 Pi package 可以同时提供扩展、skill、prompt 模板与主题。安装会执行 npm 或 git 操作。"
    >
      <SettingsGroup
        title={`用户级 packages（${userPackages.length} 个）`}
        description="来源可以是 npm 包名、git 仓库，或本地目录。"
      >
        <SettingsRow label="来源列表" hint="settings.packages">
          <ChipList items={userPackages} empty="未配置" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={`项目级 packages（${projectPackages.length} 个）`}>
        <SettingsRow label="来源列表" hint=".pi/settings.json 的 packages">
          <ChipList items={projectPackages} empty="未配置" />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        本轮只显示配置中的来源字符串。安装状态（已安装路径、是否被过滤、可更新版本）需要
        SDK 的 <span className="font-mono">DefaultPackageManager</span>，与安装 / 移除 / 更新
        一起在 P3 接入。届时安装会先展示将要执行的命令并在确认后才运行。
      </NoticeBlock>
    </SectionShell>
  )
}

/** 项目级 packages 可能是字符串或对象形式（{ source, autoload, ... }） */
function toSourceList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object') {
      const inner = (item as { source?: unknown }).source
      if (typeof inner === 'string') return inner
    }
    return String(item)
  })
}
