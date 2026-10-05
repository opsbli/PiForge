import { useCallback, useEffect, useState, type JSX } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import type { CredentialStatus, CustomProvider } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useCustomProvidersStore } from '@renderer/stores/custom-providers-store'
import { useComposerStore } from '@renderer/stores/composer-store'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { ProviderForm } from '../ProviderForm'
import { ChipList, NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 模型：凭据 + 模型与思考 + 自定义 provider（models.json） */
export function ModelSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resolved = settings?.resolved

  const customProviders = useCustomProvidersStore((s) => s.providers)
  const templates = useCustomProvidersStore((s) => s.templates)
  const loadProviders = useCustomProvidersStore((s) => s.load)
  const loadTemplates = useCustomProvidersStore((s) => s.loadTemplates)
  const removeProvider = useCustomProvidersStore((s) => s.remove)

  // editing：undefined = 列表；null = 新建；对象 = 编辑
  const [editing, setEditing] = useState<CustomProvider | null | undefined>(undefined)

  useEffect(() => {
    void loadProviders()
    void loadTemplates()
  }, [loadProviders, loadTemplates])

  // provider 配置变化会重启 agent，等就绪后刷新输入框模型清单
  const refreshComposerModels = async (): Promise<void> => {
    await window.piforge.waitAgentReady()
    await useComposerStore.getState().loadModels()
    await useComposerStore.getState().refreshMeta()
  }

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

  // 编辑/新建时切换到表单页
  if (editing !== undefined) {
    return (
      <ProviderForm
        provider={editing}
        templates={templates}
        onCancel={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          void loadProviders()
          void refreshComposerModels()
        }}
      />
    )
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

      <SettingsGroup title="模型与思考">        <SettingsFieldRow fieldKey="defaultProvider" label="默认 provider" hint="如 deepseek" />
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

      <SettingsGroup
        title="自定义模型（models.json）"
        description="配置自定义 endpoint 与模型。密钥用 safeStorage 加密保存，models.json 只写入非敏感字段。"
      >
        {customProviders.length === 0 ? (
          <p className="px-3 py-3 text-[11px] text-muted-foreground">
            还没有自定义 provider，点下方按钮添加
          </p>
        ) : (
          customProviders.map((provider) => (
            <div key={provider.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-foreground">
                  <span className="truncate">{provider.name}</span>
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10px] text-muted-foreground">
                    {provider.enabled ? '已启用' : '已停用'}
                  </span>
                  {!provider.hasApiKey && (
                    <span className="shrink-0 text-[10px] text-warning">未配置密钥</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={provider.baseUrl}>
                  {provider.baseUrl || '未设置 Base URL'} ·{' '}
                  {provider.models.filter((model) => model.enabled).length} 个模型
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(provider)}>
                <Pencil />
                编辑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (window.confirm(`确定删除自定义 provider「${provider.name}」？其模型将不再出现在选择器。`)) {
                    void removeProvider(provider.id).then(() => refreshComposerModels())
                  }
                }}
              >
                <Trash2 />
                删除
              </Button>
            </div>
          ))
        )}
        <div className="px-3 py-2.5">
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
            <Plus />
            添加模型配置
          </Button>
        </div>
      </SettingsGroup>

      <NoticeBlock>
        自定义 provider 会同步写入 agent 目录下的 models.json（不含密钥），保存后自动重启 agent
        使其生效。模型选择器只列出有凭证可用的模型，因此需填入并保存 API Key 后才会出现。
      </NoticeBlock>
    </SectionShell>
  )
}
