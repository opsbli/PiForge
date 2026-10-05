import { useEffect, useState, type JSX } from 'react'
import { Download, RefreshCw, RotateCcw } from 'lucide-react'
import type { AppInfo, UpdaterStatus } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 关于：版本、关键路径与更新 */
export function AboutSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const trust = useSettingsStore((s) => s.trust)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [update, setUpdate] = useState<UpdaterStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.piforge.getAppInfo().then(setAppInfo)
  }, [])

  useEffect(() => window.piforge.onUpdaterStatus(setUpdate), [])

  const check = async (): Promise<void> => {
    setBusy(true)
    try {
      setUpdate(await window.piforge.checkForUpdates())
    } finally {
      setBusy(false)
    }
  }

  const paths = settings?.paths

  return (
    <SectionShell title="关于" description="版本信息、配置文件位置与更新。">
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

      <SettingsGroup title="更新" description="更新源为 GitHub Releases；开发模式下跳过检查。">
        <SettingsRow label="状态" hint={updateStatusHint(update)}>
          <ValueText value={describeUpdate(update)} />
        </SettingsRow>
        <SettingsRow label="操作">
          <div className="flex items-center gap-1.5">
            {update?.state === 'available' && (
              <Button
                variant="default"
                size="sm"
                disabled={busy}
                onClick={() => void window.piforge.downloadUpdate()}
              >
                <Download />
                下载
              </Button>
            )}
            {update?.state === 'downloaded' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => void window.piforge.installUpdate()}
              >
                <RotateCcw />
                重启安装
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void check()}>
              <RefreshCw />
              检查更新
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="目录">
        <SettingsRow label="agent 目录" hint="用户级配置与会话的根目录">
          <ValueText value={paths?.agentDir} mono />
        </SettingsRow>
        <SettingsRow label="当前工作区">
          <ValueText value={paths?.cwd} mono />
        </SettingsRow>
        <SettingsRow label="当前项目是否被信任">
          <ValueText value={trust ? (trust.loaderTrusted ? '已信任' : '未信任') : null} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="配置文件" description="只探测存在性与体积；不会读取 auth.json 的内容。">
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

      {(update?.state === 'error' || update?.message) && (
        <NoticeBlock tone={update?.state === 'error' ? 'warning' : 'neutral'}>
          {update?.message}
        </NoticeBlock>
      )}
    </SectionShell>
  )
}

function describeUpdate(status: UpdaterStatus | null): string | null {
  if (!status) return null
  switch (status.state) {
    case 'idle':
      return '空闲'
    case 'checking':
      return '检查中…'
    case 'available':
      return `有可用更新${status.version ? ` · ${status.version}` : ''}`
    case 'not-available':
      return '已是最新版本'
    case 'downloading':
      return `下载中 ${status.percent !== undefined ? `${status.percent.toFixed(0)}%` : ''}`.trim()
    case 'downloaded':
      return `已下载${status.version ? ` · ${status.version}` : ''}，可重启安装`
    case 'error':
      return '检查失败'
  }
}

function updateStatusHint(status: UpdaterStatus | null): string | undefined {
  if (!status) return '尚未检查'
  return undefined
}
