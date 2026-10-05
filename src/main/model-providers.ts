import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  CustomProvider,
  ProviderProbeRequest,
  SaveProviderRequest
} from '../shared/ipc-types'

/**
 * 自定义 provider / 模型配置。
 *
 * 存储分层：
 *   - `userData/model-providers.json`：非敏感配置（id / name / baseUrl / api / enabled / models）+ 托管 id 列表。
 *   - `userData/model-provider-keys.bin`：provider API Key，整体用 Electron safeStorage 加密。
 *   - `<agentDir>/models.json`：由本模块**生成**的非敏感同步产物（不含密钥），供 SDK 加载。
 *
 * 安全约束：密钥永不明文落盘，也永不写进 models.json；渲染进程只能拿到 hasApiKey 布尔值。
 */

interface StoredConfig {
  managed: string[]
  providers: StoredProvider[]
}

/** 落盘形态：不含 hasApiKey（由密钥文件推导） */
type StoredProvider = Omit<CustomProvider, 'hasApiKey'>

const configFile = (): string => join(app.getPath('userData'), 'model-providers.json')
const keysFile = (): string => join(app.getPath('userData'), 'model-provider-keys.bin')

let providers: StoredProvider[] = []
let keys: Record<string, string> = {}
/** 上次同步给 models.json 的托管 id，用于在合并时清除已删除/改名的条目 */
let managedSnapshot: string[] = []

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
}

/** 启动时载入配置与密钥 */
export function initModelProviders(): void {
  const stored = readJson<StoredConfig>(configFile(), { managed: [], providers: [] })
  providers = Array.isArray(stored.providers) ? stored.providers : []
  managedSnapshot = Array.isArray(stored.managed) ? stored.managed : []

  const path = keysFile()
  if (existsSync(path) && safeStorage.isEncryptionAvailable()) {
    try {
      const decrypted = safeStorage.decryptString(readFileSync(path))
      const parsed = JSON.parse(decrypted) as Record<string, string>
      keys = parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      keys = {}
    }
  }
}

function persistConfig(): void {
  const managed = providers.map((provider) => provider.id)
  writeJson(configFile(), { managed, providers } satisfies StoredConfig)
}

function persistKeys(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不支持 safeStorage 加密，拒绝以明文保存 API Key')
  }
  const path = keysFile()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, safeStorage.encryptString(JSON.stringify(keys)))
}

function withHasKey(provider: StoredProvider): CustomProvider {
  return { ...provider, hasApiKey: Boolean(keys[provider.id]) }
}

/** 由名称派生 provider id：只保留 ASCII 字母数字，其余折叠为连字符 */
function slugify(name: string, fallback: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // 去除非 ASCII（含 CJK）字符：id 会作为 models.json 的键，保持 ASCII 更稳妥
    .replace(/[^\x20-\x7e]/g, '')
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

/** 保证 id 在现有配置中唯一，重名追加 -2 / -3 */
function uniqueId(base: string): string {
  const taken = new Set(providers.map((provider) => provider.id))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

export function listProviders(): CustomProvider[] {
  return providers.map(withHasKey)
}

/** 供 agent 进程注入运行时凭证使用；仅主进程内部调用 */
export function getProviderKeys(): Record<string, string> {
  return { ...keys }
}

export function saveProvider(request: SaveProviderRequest): CustomProvider[] {
  const incoming = request.provider
  // 编辑时沿用原 id（密钥与 models.json 映射保持稳定）；新建时由名称派生
  const editingId = request.id?.trim()
  const id =
    editingId ||
    uniqueId(
      slugify(
        incoming.name,
        incoming.templateProviderId ? `${incoming.templateProviderId}-custom` : 'custom-provider'
      )
    )

  const next: StoredProvider = {
    id,
    name: incoming.name.trim() || id,
    templateProviderId: incoming.templateProviderId ?? null,
    baseUrl: incoming.baseUrl.trim(),
    api: incoming.api.trim(),
    enabled: incoming.enabled !== false,
    models: incoming.models.map((model) => ({
      id: model.id.trim(),
      name: model.name?.trim() || undefined,
      enabled: model.enabled !== false
    }))
  }

  const index = providers.findIndex((provider) => provider.id === id)
  if (index >= 0) providers[index] = next
  else providers.push(next)

  if (typeof request.apiKey === 'string') {
    const key = request.apiKey.trim()
    if (key) keys[id] = key
    else delete keys[id]
    persistKeys()
  }

  persistConfig()
  return listProviders()
}

export function deleteProvider(id: string): CustomProvider[] {
  providers = providers.filter((provider) => provider.id !== id)
  if (keys[id]) {
    delete keys[id]
    persistKeys()
  }
  persistConfig()
  return listProviders()
}

/**
 * 生成 `<agentDir>/models.json`。
 * 合并策略：只覆盖/删除本应用托管的 provider，保留文件里其他手写内容。
 */
export function syncModelsJson(agentDir: string): void {
  const modelsPath = join(agentDir, 'models.json')
  const existing = readJson<{ providers?: Record<string, unknown> }>(modelsPath, {})
  const merged: Record<string, unknown> = { ...(existing.providers ?? {}) }

  // 先删掉上一轮托管的条目，再写入当前托管条目；其余手写内容保留
  for (const id of managedSnapshot) delete merged[id]

  for (const provider of providers) {
    if (!provider.enabled) continue
    const enabledModels = provider.models.filter((model) => model.enabled && model.id)
    if (enabledModels.length === 0) continue
    const entry: Record<string, unknown> = {
      name: provider.name,
      models: enabledModels.map((model) => ({ id: model.id, ...(model.name ? { name: model.name } : {}) }))
    }
    if (provider.baseUrl) entry.baseUrl = provider.baseUrl
    if (provider.api) entry.api = provider.api
    merged[provider.id] = entry
  }

  writeJson(modelsPath, { providers: merged })
  managedSnapshot = providers.map((provider) => provider.id)
}

/** 解析探测用密钥：优先请求体里显式传入的，其次该 provider 已存密钥 */
export function resolveProbeKey(
  request: Pick<ProviderProbeRequest, 'providerId' | 'apiKey'>
): string {
  if (typeof request.apiKey === 'string' && request.apiKey.trim()) return request.apiKey.trim()
  if (request.providerId && keys[request.providerId]) return keys[request.providerId]
  return ''
}
