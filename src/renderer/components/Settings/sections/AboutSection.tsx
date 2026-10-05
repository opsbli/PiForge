import { useEffect, useState, type JSX } from 'react'
import type { AppInfo } from '@shared/ipc-types'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 关于：版本与关键路径 */
export function AboutSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.piforge.getAppInfo().then(setAppInfo)
  }, [])

  const paths = settings?.paths

  return (
    <SectionShell title="关于" description="版本信息与配置文件位置。所有路径均为绝对路径。">
      <SettingsGroup title="版本">
        <SettingsRow label="PiForge Desktop">
          <ValueText value={appInfo?.appVersion} />
        </SettingsRow>
        <SettingsRow label="Electron">
          <ValueText value={appInfo?.electron} />
        </SettingsRow>
        <SettingsRow label="Chromium">
          <ValueText value={appInfo?.chrome} />
        </SettingsRow>
        <SettingsRow label="Node.js">
          <ValueText value={appInfo?.node} />
        </SettingsRow>
        <SettingsRow label="pi-agent SDK" hint="agent 进程加载的版本">
          <ValueText value={settings?.versions.sdk} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="目录">
        <SettingsRow label="agent 目录" hint="用户级配置与会话的根目录">
          <ValueText value={paths?.agentDir} mono />
        </SettingsRow>
        <SettingsRow label="当前工作区">
          <ValueText value={paths?.cwd} mono />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="配置文件"
        description="只探测存在性与体积；不会读取 auth.json 的内容。"
      >
        {(settings?.files ?? []).map((file) => (
          <SettingsRow key={file.path} label={file.path} mono>
            <span className={file.exists ? 'text-success' : 'text-muted-foreground'}>
              {file.exists
                ? file.isDirectory
                  ? '目录'
                  : `存在 · ${file.bytes ?? 0} 字节`
                : '不存在'}
            </span>
          </SettingsRow>
        ))}
        {(settings?.files ?? []).length === 0 && (
          <SettingsRow label="暂无可显示的文件">
            <ValueText value={null} />
          </SettingsRow>
        )}
      </SettingsGroup>
    </SectionShell>
  )
}
