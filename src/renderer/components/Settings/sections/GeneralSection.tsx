import type { JSX } from 'react'
import { Select } from '@renderer/components/ui/select'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useThemeStore, type ThemeMode } from '@renderer/stores/theme-store'
import { NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 通用：PiForge 自身的界面偏好，与 pi-agent 的配置无关 */
export function GeneralSection(): JSX.Element {
  const themeMode = useThemeStore((s) => s.mode)
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const setMode = useThemeStore((s) => s.setMode)
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const rightPanelWidth = useLayoutStore((s) => s.rightPanelWidth)

  return (
    <SectionShell title="通用" description="PiForge 自身的界面偏好，与 pi-agent 的配置无关。">
      <SettingsGroup title="外观">
        <SettingsRow label="主题" hint="暗色 / 亮色 / 跟随系统">
          <Select
            value={themeMode}
            onChange={(event) => setMode(event.target.value as ThemeMode)}
          >
            <option value="dark">暗色</option>
            <option value="light">亮色</option>
            <option value="system">跟随系统</option>
          </Select>
        </SettingsRow>
        <SettingsRow label="当前生效" hint="由主题选项与系统设置共同决定">
          <ValueText value={resolvedTheme === 'dark' ? '暗色' : '亮色'} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="布局" description="拖拽左栏 / 右栏边缘可调宽，双击手柄复位。">
        <SettingsRow label="左栏宽度">
          <ValueText value={`${sidebarWidth} px`} />
        </SettingsRow>
        <SettingsRow label="右栏宽度">
          <ValueText value={`${rightPanelWidth} px`} />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        主题切换与布局调整已可用。布局偏好的持久化、以及其余通用项将在 P2 开放写入。
      </NoticeBlock>
    </SectionShell>
  )
}
