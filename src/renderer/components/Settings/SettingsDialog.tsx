import { useEffect, useState, type JSX } from 'react'
import type { CredentialStatus } from '@shared/ipc-types'

/** 最小设置：写入 DeepSeek API Key（safeStorage 加密存储） */
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

  useEffect(() => {
    if (open) {
      void window.piforge.getCredentialStatus().then(setStatus)
    }
  }, [open])

  if (!open) return null

  const save = async (): Promise<void> => {
    const key = apiKey.trim()
    if (!key) return
    setSaving(true)
    await window.piforge.setApiKey(key)
    setApiKey('')
    setStatus(await window.piforge.getCredentialStatus())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">设置 · API Key</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          API Key 使用 Electron safeStorage 加密存储，不会写入 localStorage。
        </p>

        <div className="mt-4">
          <label className="text-xs text-muted-foreground">DeepSeek API Key</label>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={apiKey}
            placeholder="sk-..."
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
        </div>

        {status && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div>加密可用：{status.encryptionAvailable ? '是' : '否（无法安全保存）'}</div>
            <div>已保存加密 Key：{status.hasStoredKey ? '是' : '否'}</div>
            <div>正在使用环境变量：{status.usingEnvVar ? '是' : '否'}</div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={saving || !apiKey.trim()}
            onClick={() => void save()}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
