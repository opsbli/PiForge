import { useCallback, useEffect, useState, type JSX } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { CredentialStatus } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { SandboxSettings } from '@renderer/components/Sandbox/SandboxSettings'

/** 设置：写入 DeepSeek API Key（safeStorage 加密存储）+ 执行沙箱配置 */
export function SettingsDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<CredentialStatus | null>(null)
  const [saving, setSaving] = useState(false)

  const refreshStatus = useCallback(async (): Promise<void> => {
    setStatus(await window.piforge.getCredentialStatus())
  }, [])

  useEffect(() => {
    if (open) void refreshStatus()
  }, [open, refreshStatus])

  const save = async (): Promise<void> => {
    const key = apiKey.trim()
    if (!key) return
    setSaving(true)
    await window.piforge.setApiKey(key)
    setApiKey('')
    await refreshStatus()
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader
        title="设置"
        icon={<SettingsIcon className="size-4" />}
        description="API Key 使用 Electron safeStorage 加密存储，不会写入 localStorage。"
        onClose={onClose}
      />

      <DialogBody>
        <label htmlFor="piforge-api-key" className="text-[11px] text-muted-foreground">
          DeepSeek API Key
        </label>
        <Input
          id="piforge-api-key"
          type="password"
          className="mt-1"
          value={apiKey}
          placeholder="sk-..."
          onChange={(event) => setApiKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
          }}
        />

        {status && (
          <dl className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
            <StatusRow label="加密可用" value={status.encryptionAvailable ? '是' : '否（无法安全保存）'} />
            <StatusRow label="已保存加密 Key" value={status.hasStoredKey ? '是' : '否'} />
            <StatusRow label="正在使用环境变量" value={status.usingEnvVar ? '是' : '否'} />
          </dl>
        )}

        <SandboxSettings />
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
        <Button variant="default" disabled={saving || !apiKey.trim()} onClick={() => void save()}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function StatusRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex gap-2">
      <dt>{label}：</dt>
      <dd>{value}</dd>
    </div>
  )
}
