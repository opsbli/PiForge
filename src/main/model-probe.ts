import type { ProviderProbeRequest, ProviderProbeResult } from '../shared/ipc-types'
import { resolveProbeKey } from './model-providers'

/**
 * 供应商探测：既用于「测试连接」，也用于「从供应商获取」模型清单。
 * 两者请求同一个端点，只是对返回的模型列表使用方式不同。
 *
 * 端点按 api 类型推断：
 *   - anthropic-messages → GET {base}/v1/models + x-api-key
 *   - 其他（openai-* 等）→ GET {base}/models + Authorization: Bearer
 */

const TIMEOUT_MS = 15_000

function buildEndpoint(
  baseUrl: string,
  api: string
): { url: string; headers: (key: string) => Record<string, string> } {
  const base = baseUrl.replace(/\/+$/, '')
  if (api === 'anthropic-messages') {
    return {
      url: `${base}/v1/models`,
      headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' })
    }
  }
  return {
    url: `${base}/models`,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  }
}

function parseModels(payload: unknown): Array<{ id: string; name?: string }> {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const list = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : []

  const models: Array<{ id: string; name?: string }> = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const id = typeof entry.id === 'string' ? entry.id : undefined
    if (!id) continue
    const name =
      typeof entry.display_name === 'string'
        ? entry.display_name
        : typeof entry.name === 'string'
          ? entry.name
          : undefined
    models.push({ id, name })
  }
  return models
}

export async function probeProvider(request: ProviderProbeRequest): Promise<ProviderProbeResult> {
  const baseUrl = (request.baseUrl ?? '').trim()
  if (!baseUrl) return { ok: false, error: 'Base URL 不能为空', models: [] }

  const key = resolveProbeKey(request)
  if (!key) return { ok: false, error: '请先填写 API Key', models: [] }

  const { url, headers } = buildEndpoint(baseUrl, request.api ?? '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers(key),
      signal: controller.signal
    })
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}：${text.slice(0, 300)}`, models: [] }
    }
    let payload: unknown = null
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
    return { ok: true, models: parseModels(payload) }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `请求超时（${TIMEOUT_MS / 1000} 秒）`
        : String(error)
    return { ok: false, error: message, models: [] }
  } finally {
    clearTimeout(timer)
  }
}
