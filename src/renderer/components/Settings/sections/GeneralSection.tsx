import { useEffect, useState, type JSX } from 'react'
import { ImagePlus, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { ProfileAvatar } from '@renderer/components/Profile/ProfileAvatar'
import { useLayoutStore } from '@renderer/stores/layout-store'
import { useProfileStore } from '@renderer/stores/profile-store'
import { useThemeStore, type ThemeMode } from '@renderer/stores/theme-store'
import { NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 通用：PiForge 自身的界面偏好与个人资料，与 pi-agent 的配置无关 */
export function GeneralSection(): JSX.Element {
  const themeMode = useThemeStore((s) => s.mode)
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const setMode = useThemeStore((s) => s.setMode)

  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const rightPanelWidth = useLayoutStore((s) => s.rightPanelWidth)
  const autoOpenEditor = useLayoutStore((s) => s.autoOpenEditor)
  const setAutoOpenEditor = useLayoutStore((s) => s.setAutoOpenEditor)

  const nickname = useProfileStore((s) => s.nickname)
  const avatarDataUrl = useProfileStore((s) => s.avatarDataUrl)
  const defaultNickname = useProfileStore((s) => s.defaultNickname)
  const setNickname = useProfileStore((s) => s.setNickname)
  const pickAvatar = useProfileStore((s) => s.pickAvatar)
  const clearAvatar = useProfileStore((s) => s.clearAvatar)

  const [nicknameDraft, setNicknameDraft] = useState(nickname ?? '')
  useEffect(() => {
    setNicknameDraft(nickname ?? '')
  }, [nickname])

  const commitNickname = (): void => {
    if (nicknameDraft.trim() === (nickname ?? '')) return
    void setNickname(nicknameDraft)
  }

  return (
    <SectionShell title="通用" description="PiForge 自身的界面偏好与本机个人资料，与 pi-agent 的配置无关。">
      <SettingsGroup title="个人资料" description="头像与昵称保存在本机，显示在左下角。">
        <SettingsRow label="头像" hint="从本地选择图片（png / jpg / webp / gif / bmp，≤ 5MB）">
          <div className="flex items-center gap-2">
            <ProfileAvatar avatarDataUrl={avatarDataUrl} className="size-8 rounded-lg" />
            <Button variant="outline" size="sm" onClick={() => void pickAvatar()}>
              <ImagePlus />
              上传图片
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!avatarDataUrl}
              onClick={() => void clearAvatar()}
            >
              <RotateCcw />
              恢复默认
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow label="昵称" hint={`留空则使用默认昵称：${defaultNickname}`}>
          <Input
            className="h-6 w-44 text-right text-[11px]"
            value={nicknameDraft}
            placeholder={defaultNickname}
            onChange={(event) => setNicknameDraft(event.target.value)}
            onBlur={commitNickname}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitNickname()
                event.currentTarget.blur()
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>

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

      <SettingsGroup title="布局" description="拖拽左栏 / 右栏边缘可调宽，双击手柄复位。以下偏好会持久化。">
        <SettingsRow label="左栏宽度">
          <ValueText value={`${sidebarWidth} px`} />
        </SettingsRow>
        <SettingsRow label="右栏宽度">
          <ValueText value={`${rightPanelWidth} px`} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="行为">
        <SettingsRow
          label="打开文件后切到编辑器"
          hint="关闭后文件仍会载入，只是不把中栏从当前视图切走"
        >
          <Switch
            checked={autoOpenEditor}
            onChange={setAutoOpenEditor}
            label="打开文件后切到编辑器"
          />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        主题、布局、视图偏好即时生效并持久化到本地。这些是 PiForge 自己的界面设置，
        不写入 pi-agent 的 settings.json。
      </NoticeBlock>
    </SectionShell>
  )
}
