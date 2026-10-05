import { useCallback, useEffect, useState, type JSX } from 'react'
import { Check } from 'lucide-react'
import type { CredentialStatus } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { ChipList, NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 模型：凭据 + 模型与思考（可写字段由字段规格驱动） */
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
      description="默认模型、思考等级与凭据。带「生效值」的行会同时显示未显式设置时的内置默认。"
    >
      <SettingsGroup
        title="凭据"
        description="API Key 使用 Electron safeStorage 加密存储，不写入 auth.json 或 localStorage。"
      >
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
        <SettingsFieldRow fieldKey="defaultProvider" label="默认 provider" hint="如 deepseek" />
        <SettingsFieldRow fieldKey="defaultModel" label="默认模型" hint="如 deepseek-flash" />
        <SettingsFieldRow
          fieldKey="defaultThinkingLevel"
          label="默认思考等级"
          hint="保存后立即生效"
          enumLabels={{
            off: '关闭',
            minimal: '最低',
            low: '低',
            medium: '中',
            high: '高',
            xhigh: '很高',
            max: '最高'
          }}
        />
        <SettingsFieldRow
          fieldKey="cacheWarming"
          label="提示缓存保温"
          hint="保温会产生实际费用，只能写在用户级配置"
          enumLabels={{ off: '关闭', streaming: '运行中保温', idle: '空闲也保温' }}
        />
        <SettingsFieldRow
          fieldKey="hideThinkingBlock"
          label="隐藏 thinking 块"
          hint="只影响转录展示"
        />
        <SettingsFieldRow
          fieldKey="enabledModels"
          label="可轮换模型范围"
          hint="模型模式，与 --models 同格式"
        />

        <SettingsRow
          label="按模型思考等级"
          hint="modelThinkingLevels，键为 provider/modelId；本轮只读"
        >
          <ChipList
            items={Object.entries(resolved?.modelThinkingLevels ?? {}).map(
              ([model, level]) => `${model} → ${level}`
            )}
          />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        自定义 endpoint 与自定义模型（agent 目录下的 models.json）尚未接入，会在后续阶段处理。
      </NoticeBlock>
    </SectionShell>
  )
}
