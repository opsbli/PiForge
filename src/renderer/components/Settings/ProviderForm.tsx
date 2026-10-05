import { useMemo, useState, type JSX } from 'react'
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RotateCcw,
  Zap
} from 'lucide-react'
import type { CustomModelEntry, CustomProvider, ProviderTemplate } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { NoticeBlock } from './SettingsLayout'
import { cn } from '@renderer/lib/utils'

/**
 * 「添加 / 编辑模型配置」页（对齐参考图）。
 *
 * API Key 只以输入态存在于渲染进程：保存时交给主进程写 safeStorage，
 * 编辑已存在配置时若不重填则保留原密钥（接口只回传 hasApiKey）。
 */

/** Base URL 预览：按 api 类型推断最终请求端点 */
export function previewEndpoint(baseUrl: string, api: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) return '—'
  if (api === 'anthropic-messages') return `${base}/v1/messages`
  if (api === 'openai-responses' || api === 'azure-openai-responses') return `${base}/responses`
  return `${base}/chat/completions`
}

export function ProviderForm({
  provider,
  templates,
  onCancel,
  onSaved
}: {
  provider: CustomProvider | null
  templates: ProviderTemplate[]
  onCancel: () => void
  onSaved: () => void
}): JSX.Element {
  const [templateId, setTemplateId] = useState(provider?.templateProviderId ?? '')
  const [name, setName] = useState(provider?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [api, setApi] = useState(provider?.api ?? '')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [enabled, setEnabled] = useState(provider?.enabled ?? true)
  const [models, setModels] = useState<CustomModelEntry[]>(provider?.models ?? [])
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'probe' | 'fetch'>(null)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models])
  const availableModels = useMemo(() => models.filter((model) => !model.enabled), [models])

  const applyTemplate = (nextTemplateId: string): void => {
    setTemplateId(nextTemplateId)
    const template = templates.find((item) => item.id === nextTemplateId)
    if (!template) return
    if (!baseUrl.trim()) setBaseUrl(template.baseUrl)
    if (!api.trim()) setApi(template.api)
    if (!name.trim()) setName(`${template.name}（自定义）`)
  }

  const addModel = (entry: CustomModelEntry): void => {
    setModels((prev) => {
      const index = prev.findIndex((model) => model.id === entry.id)
      if (index >= 0) {
        const next = [...prev]
        next[index] = { ...next[index], ...entry }
        return next
      }
      return [...prev, entry]
    })
  }

  const manualAdd = (): void => {
    const modelId = newModelId.trim()
    if (!modelId) return
    addModel({ id: modelId, name: newModelName.trim() || undefined, enabled: true })
    setNewModelId('')
    setNewModelName('')
  }

  const probe = async (mode: 'probe' | 'fetch'): Promise<void> => {
    setBusy(mode)
    setFeedback(null)
    try {
      const request = { providerId: provider?.id, baseUrl, api, apiKey: apiKey || undefined }
      const result =
        mode === 'probe'
          ? await window.piforge.probeProvider(request)
          : await window.piforge.fetchProviderModels(request)
      if (!result.ok) {
        setFeedback({ tone: 'error', text: `失败：${result.error ?? '未知错误'}` })
        return
      }
      if (mode === 'probe') {
        setFeedback({
          tone: 'ok',
          text: `连接成功${result.models.length > 0 ? `，可见 ${result.models.length} 个模型` : ''}`
        })
      } else if (result.models.length === 0) {
        setFeedback({ tone: 'error', text: '连接成功但未返回模型；可手动填写模型 ID' })
      } else {
        for (const model of result.models) addModel({ id: model.id, name: model.name, enabled: false })
        setFeedback({ tone: 'ok', text: `已获取 ${result.models.length} 个模型，可在「可用模型」中启用` })
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: `失败：${String(error)}` })
    } finally {
      setBusy(null)
    }
  }

  const save = async (): Promise<void> => {
    setBusy('save')
    setFeedback(null)
    try {
      await window.piforge.saveCustomProvider({
        id: provider?.id,
        provider: {
          name: name.trim() || '未命名供应商',
          templateProviderId: templateId || null,
          baseUrl,
          api,
          enabled,
          models
        },
        apiKey: apiKey ? apiKey : undefined
      })
      onSaved()
    } catch (error) {
      setFeedback({ tone: 'error', text: `保存失败：${String(error)}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft />
          返回
        </Button>
        <span className="text-sm font-semibold">{provider ? '编辑模型配置' : '添加模型配置'}</span>
        <Button
          variant="default"
          size="sm"
          className="ml-auto"
          disabled={busy !== null}
          onClick={() => void save()}
        >
          {busy === 'save' ? '保存中…' : provider ? '保存' : '创建'}
        </Button>
      </header>

      <section className="overflow-hidden rounded-lg border border-border">
        <header className="border-b border-border bg-card/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          基本信息
        </header>

        <div className="divide-y divide-border">
          <Field label="供应商类型" hint="选择内置类型可预填 Base URL 与 API 协议">
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
            >
              <option value="">（自定义）</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.id}
                </option>
              ))}
            </select>
          </Field>

          <Field label="供应商名称" hint="用于生成内部标识；重名会自动追加后缀">
            <Input
              className="h-8 text-xs"
              value={name}
              placeholder="例如 My Anthropic"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Base URL" hint={`预览：${previewEndpoint(baseUrl, api)}`}>
            <Input
              className="h-8 text-xs"
              value={baseUrl}
              placeholder="https://api.anthropic.com"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </Field>

          <Field label="API 协议" hint="留空则由供应商类型推断">
            <Input
              className="h-8 text-xs"
              value={api}
              placeholder="例如 anthropic-messages / openai-completions"
              onChange={(event) => setApi(event.target.value)}
            />
          </Field>

          <Field
            label="API Key"
            hint={
              provider?.hasApiKey
                ? '已保存加密密钥；留空则保持不变'
                : '保存时用 safeStorage 加密，不写入 models.json'
            }
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  className="h-8 pr-8 text-xs"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  placeholder={provider?.hasApiKey ? '（保持不变）' : '输入 API Key'}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                  className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey((value) => !value)}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={busy !== null}
                onClick={() => void probe('probe')}
              >
                {busy === 'probe' ? <Loader2 className="animate-spin" /> : <Zap />}
                测试连接
              </Button>
            </div>
          </Field>

          <div className="flex items-center gap-4 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-foreground">启用此配置</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                关闭后该配置的模型不会在选择列表中出现
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="启用此配置"
              onClick={() => setEnabled((value) => !value)}
              className={cn(
                'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                enabled ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-background transition-all',
                  enabled ? 'left-[1.125rem]' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {feedback && (
        <NoticeBlock tone={feedback.tone === 'error' ? 'warning' : 'neutral'}>
          {feedback.text}
        </NoticeBlock>
      )}

      <section className="overflow-hidden rounded-lg border border-border">
        <header className="border-b border-border bg-card/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          已启用模型
        </header>
        <div className="p-2">
          {enabledModels.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
              还没有启用任何模型，从下方可用模型中选择
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {enabledModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  title={`${model.id}（点击停用）`}
                  onClick={() =>
                    setModels((prev) =>
                      prev.map((item) =>
                        item.id === model.id ? { ...item, enabled: false } : item
                      )
                    )
                  }
                  className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] text-foreground hover:bg-accent/70"
                >
                  <Check className="size-3 text-primary" />
                  <span className="max-w-[14rem] truncate">{model.name ?? model.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border">
        <header className="flex items-center gap-2 border-b border-border bg-card/40 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            可用模型
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={busy !== null}
            onClick={() => void probe('fetch')}
          >
            {busy === 'fetch' ? <Loader2 className="animate-spin" /> : <Download />}
            从供应商获取
          </Button>
        </header>

        <div className="flex flex-col gap-2 p-2">
          {availableModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  title={`${model.id}（点击启用）`}
                  onClick={() =>
                    setModels((prev) =>
                      prev.map((item) =>
                        item.id === model.id ? { ...item, enabled: true } : item
                      )
                    )
                  }
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <Plus className="size-3" />
                  <span className="max-w-[14rem] truncate">{model.name ?? model.id}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs"
              value={newModelId}
              placeholder="模型 ID（如 claude-opus-4-6）"
              onChange={(event) => setNewModelId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  manualAdd()
                }
              }}
            />
            <Input
              className="h-8 text-xs"
              value={newModelName}
              placeholder="显示名称（可选）"
              onChange={(event) => setNewModelName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  manualAdd()
                }
              }}
            />
            <Button
              variant="secondary"
              size="icon-sm"
              className="shrink-0"
              aria-label="添加模型"
              title="添加模型"
              disabled={!newModelId.trim()}
              onClick={manualAdd}
            >
              <Plus />
            </Button>
          </div>

          {models.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setModels([])}
            >
              <RotateCcw />
              清空模型列表
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: JSX.Element
}): JSX.Element {
  return (
    <div className="px-3 py-2.5">
      <div className="text-xs text-foreground">{label}</div>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
