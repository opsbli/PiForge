import { useCallback, useEffect, useState, type JSX } from 'react'
import { Check, KeyRound, TriangleAlert } from 'lucide-react'
import type { CredentialStatus } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow,
  ValueText
} from '../SettingsLayout'

/** 模型：API Key（写法沿用原有 safeStorage 流程）+ 模型与思考的生效值 */
export function ModelSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resolved = settings?.resolved

  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<CredentialStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refreshStatus = useCallback(async (): Promise<void> => {
    setStatus(await window.piforge.getCredentialStatus())
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const save = async (): Promise<void> => {
    const key = apiKey.trim()
    if (!key) return
    setSaving(true)
    setFeedback(null)
    try {
      await window.piforge.setApiKey(key)
      setApiKey('')
      await refreshStatus()
      setFeedback('已保存，Agent 已重启')
    } catch (err) {
      setFeedback(`保存失败：${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionShell
      title="模型"
      description="默认模型、思考等级与凭据。带「生效值」的项含 SDK 内置默认，不代表已在配置文件中显式设置。"
    >
      <SettingsGroup title="凭据" description="API Key 使用 Electron safeStorage 加密存储，不写入 auth.json 或 localStorage。">
        <div className="px-3 py-2.5">
          <label htmlFor="settings-api-key" className="text-xs text-foreground">
            DeepSeek API Key
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id="settings-api-key"
              type="password"
              value={apiKey}
              placeholder="sk-..."
              onChange={(event) => setApiKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void save()
              }}
            />
            <Button
              variant="default"
              className="shrink-0"
              disabled={saving || !apiKey.trim()}
              onClick={() => void save()}
            >
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
          {feedback && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-success">
              <Check className="size-3" />
              {feedback}
            </p>
          )}
        </div>

        <SettingsRow label="加密可用" hint="safeStorage 是否可用；不可用时无法安全保存">
          <ValueText value={status ? status.encryptionAvailable : null} />
        </SettingsRow>
        <SettingsRow label="已保存加密 Key">
          <ValueText value={status ? status.hasStoredKey : null} />
        </SettingsRow>
        <SettingsRow label="正在使用环境变量" hint="DEEPSEEK_API_KEY">
          <ValueText value={status ? status.usingEnvVar : null} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="模型与思考">
        <SettingsRow label="默认 provider" hint="生效值">
          <ValueText value={resolved?.defaultProvider} />
        </SettingsRow>
        <SettingsRow label="默认模型" hint="生效值">
          <ValueText value={resolved?.defaultModel} />
        </SettingsRow>
        <SettingsRow label="默认思考等级" hint="生效值；未显式设置时为 medium">
          <ValueText value={resolved?.defaultThinkingLevel} />
        </SettingsRow>
        <SettingsRow
          label="按模型思考等级"
          hint="modelThinkingLevels，键为 provider/modelId"
        >
          <ChipList
            items={Object.entries(resolved?.modelThinkingLevels ?? {}).map(
              ([model, level]) => `${model} → ${level}`
            )}
          />
        </SettingsRow>
        <SettingsRow label="可轮换模型范围" hint="enabledModels 模式">
          {resolved?.enabledModels && resolved.enabledModels.length > 0 ? (
            <ChipList items={resolved.enabledModels} />
          ) : (
            <ValueText value={null} />
          )}
        </SettingsRow>
        <SettingsRow label="隐藏 thinking 块">
          <ValueText value={resolved?.hideThinkingBlock} />
        </SettingsRow>
        <SettingsRow label="提示缓存保温" hint="cacheWarming">
          <ValueText value={resolved?.cacheWarming} />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock tone="warning">
        <span className="flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          <span>
            除 API Key 外，本分类本轮只读。修改模型与思考等级将在 P2 开放，并通过
            AgentSession 的 live setter 立即生效，不需要重载。
          </span>
        </span>
      </NoticeBlock>

      <NoticeBlock>
        <span className="flex items-start gap-1.5">
          <KeyRound className="mt-0.5 size-3 shrink-0" />
          <span>
            自定义 endpoint 与自定义模型（agent 目录下的 models.json）尚未接入，会在后续阶段处理。
          </span>
        </span>
      </NoticeBlock>
    </SectionShell>
  )
}
