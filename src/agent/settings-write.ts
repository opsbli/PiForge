import type { SettingsFieldSpec, SettingsPatchEntry, SettingsScopeName } from '../shared/ipc-types'
import { detectIndent, readJsonFile, writeJsonFile } from './json-file'

/**
 * 设置写入。
 *
 * 为什么不用 SDK 的 setter：SDK 的公开 setter 只覆盖一部分字段——
 * `defaultTools`、`codemode.*`、`compaction` 的 token 值、`branchSummary`、
 * `sessionDir`、`httpProxy` 都没有 setter，而且标量字段没有项目级写入 API。
 * 两套写路径会指向同一个文件，比一套更危险，因此这里统一自实现 JSON 合并写入，
 * 只把「读取」与「重载」交给 SDK。
 *
 * 安全约束：
 * - 只写白名单字段（FIELD_SPECS），并校验 scope 与取值
 * - 现有文件存在但无法解析时**拒绝写入**，绝不覆盖用户内容
 * - 写前备份为 `.bak`，再用同目录临时文件 + rename 原子替换，避免留下半截文件
 */

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const CACHE_WARMING = ['off', 'streaming', 'idle']
const TRANSPORT = ['auto', 'sse', 'websocket', 'websocket-cached']
const CODEMODE_MODES = ['on', 'only']
const DELIVERY_MODES = ['all', 'one-at-a-time']
const BOTH: SettingsScopeName[] = ['global', 'project']
const GLOBAL_ONLY: SettingsScopeName[] = ['global']

/**
 * 字段规格：写入能力的唯一权威。
 * `needsReload: false` 的字段在写入后会尝试通过 AgentSession 的 live setter 立即生效。
 */
export const FIELD_SPECS: SettingsFieldSpec[] = [
  // 模型
  { key: 'defaultProvider', kind: 'string', scopes: BOTH, needsReload: true },
  { key: 'defaultModel', kind: 'string', scopes: BOTH, needsReload: true },
  { key: 'defaultThinkingLevel', kind: 'enum', options: THINKING_LEVELS, scopes: BOTH, needsReload: false, defaultValue: 'medium' },
  { key: 'hideThinkingBlock', kind: 'boolean', scopes: BOTH, needsReload: true, defaultValue: false },
  // cacheWarming 文档标注为 global only（保温会产生实际费用）
  { key: 'cacheWarming', kind: 'enum', options: CACHE_WARMING, scopes: GLOBAL_ONLY, needsReload: false, defaultValue: 'streaming' },
  { key: 'enabledModels', kind: 'stringArray', scopes: BOTH, needsReload: true },

  // 工具
  { key: 'defaultTools', kind: 'stringArray', scopes: BOTH, needsReload: true },
  { key: 'codemode.mode', kind: 'enum', options: CODEMODE_MODES, scopes: BOTH, needsReload: true, defaultValue: 'on' },
  { key: 'codemode.inlineBudget', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 3000 },

  // 会话与上下文
  { key: 'compaction.enabled', kind: 'boolean', scopes: BOTH, needsReload: false, defaultValue: true },
  { key: 'compaction.reserveTokens', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 16384 },
  { key: 'compaction.keepRecentTokens', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 20000 },
  { key: 'branchSummary.reserveTokens', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 16384 },
  { key: 'branchSummary.skipPrompt', kind: 'boolean', scopes: BOTH, needsReload: true, defaultValue: false },
  { key: 'sessionDir', kind: 'string', scopes: BOTH, needsReload: true },
  { key: 'transport', kind: 'enum', options: TRANSPORT, scopes: BOTH, needsReload: true, defaultValue: 'auto' },
  // httpProxy 文档标注为只能写在 agent 目录的用户级配置
  { key: 'httpProxy', kind: 'string', scopes: GLOBAL_ONLY, needsReload: true },
  { key: 'httpIdleTimeoutMs', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 300000 },
  { key: 'retry.enabled', kind: 'boolean', scopes: BOTH, needsReload: false, defaultValue: true },
  { key: 'retry.maxRetries', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 3 },
  { key: 'retry.baseDelayMs', kind: 'number', min: 0, scopes: BOTH, needsReload: true, defaultValue: 2000 },
  { key: 'steeringMode', kind: 'enum', options: DELIVERY_MODES, scopes: BOTH, needsReload: false, defaultValue: 'one-at-a-time' },
  { key: 'followUpMode', kind: 'enum', options: DELIVERY_MODES, scopes: BOTH, needsReload: false, defaultValue: 'one-at-a-time' },
  { key: 'shellPath', kind: 'string', scopes: BOTH, needsReload: true },
  { key: 'shellCommandPrefix', kind: 'string', scopes: BOTH, needsReload: true },
  { key: 'npmCommand', kind: 'stringArray', scopes: BOTH, needsReload: true },

  // 资源路径（扩展与 skill）。
  // 已实测：**相对路径的排除语法会静默失效**，只有 glob（`!**/x/**`）与绝对路径生效，
  // 因此停用 skill 由界面生成 `!**/<目录名>/**`。
  { key: 'extensions', kind: 'stringArray', scopes: BOTH, needsReload: true },
  { key: 'skills', kind: 'stringArray', scopes: BOTH, needsReload: true },

  // 文档标注为只能写在 agent 目录的用户级配置；启动时读取
  {
    key: 'defaultProjectTrust',
    kind: 'enum',
    options: ['ask', 'always', 'never'],
    scopes: GLOBAL_ONLY,
    needsReload: true,
    defaultValue: 'ask'
  }
]

const SPEC_BY_KEY = new Map(FIELD_SPECS.map((spec) => [spec.key, spec]))

/**
 * 校验并规范化一个取值。
 *
 * `null` 表示**删除该键**（回到默认）；这与「空字符串 / 空数组」是两件事，
 * 例如 `defaultTools: []` 在 SDK 里表示禁用全部内置工具，而不是回到默认。
 */
function coerce(spec: SettingsFieldSpec, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (value === null || typeof value === 'undefined') return { ok: true, value: null }

  switch (spec.kind) {
    case 'boolean':
      return typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, error: `${spec.key} 需要布尔值` }

    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: `${spec.key} 需要数字` }
      }
      if (typeof spec.min === 'number' && value < spec.min) {
        return { ok: false, error: `${spec.key} 不能小于 ${spec.min}` }
      }
      if (typeof spec.max === 'number' && value > spec.max) {
        return { ok: false, error: `${spec.key} 不能大于 ${spec.max}` }
      }
      if (!Number.isSafeInteger(value)) return { ok: false, error: `${spec.key} 需要安全整数` }
      return { ok: true, value }
    }

    case 'string':
      return typeof value === 'string'
        ? { ok: true, value }
        : { ok: false, error: `${spec.key} 需要字符串` }

    case 'stringArray': {
      if (!Array.isArray(value)) return { ok: false, error: `${spec.key} 需要字符串数组` }
      if (!value.every((item) => typeof item === 'string')) {
        return { ok: false, error: `${spec.key} 只能包含字符串` }
      }
      return { ok: true, value }
    }

    case 'enum': {
      const options = spec.options ?? []
      if (typeof value !== 'string' || !options.includes(value)) {
        return { ok: false, error: `${spec.key} 只能是：${options.join(' / ')}` }
      }
      return { ok: true, value }
    }
  }
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {  let cursor = target
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const next = cursor[key]
    if (!next || typeof next !== 'object' || Array.isArray(next)) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[path[path.length - 1]] = value
}

/** 删除嵌套键，并自底向上清理因此产生的空对象，避免留下 `compaction: {}` */
function deletePath(target: Record<string, unknown>, path: string[]): void {
  const chain: Record<string, unknown>[] = [target]
  let cursor = target

  for (let index = 0; index < path.length - 1; index += 1) {
    const next = cursor[path[index]]
    if (!next || typeof next !== 'object' || Array.isArray(next)) return
    cursor = next as Record<string, unknown>
    chain.push(cursor)
  }
  delete cursor[path[path.length - 1]]

  for (let index = chain.length - 1; index > 0; index -= 1) {
    const parent = chain[index - 1]
    const key = path[index - 1]
    const node = parent[key]
    if (node && typeof node === 'object' && !Array.isArray(node) && Object.keys(node).length === 0) {
      delete parent[key]
    }
  }
}

export interface SettingsWriteOutcome {
  ok: boolean
  error?: string
  target?: string
  /** 实际写入的字段键 */
  changed: string[]
  /** 写入的字段键 → 规范化后的取值（null 表示删除该键） */
  changes: Record<string, unknown>
}

export function applySettingsWrite(input: {
  scope: SettingsScopeName
  entries: SettingsPatchEntry[]
  filePath: string
}): SettingsWriteOutcome {
  if (input.entries.length === 0) {
    return { ok: false, error: '没有需要写入的字段', changed: [], changes: {} }
  }

  // 先整体校验：任一字段不合法就不做任何写入，避免半截生效
  const changes: Record<string, unknown> = {}
  for (const entry of input.entries) {
    const spec = SPEC_BY_KEY.get(entry.key)
    if (!spec) return { ok: false, error: `未知字段：${entry.key}`, changed: [], changes: {} }
    if (!spec.scopes.includes(input.scope)) {
      return {
        ok: false,
        error: `${entry.key} 不支持写入到 ${input.scope === 'global' ? '用户级' : '项目级'}配置`,
        changed: [],
        changes: {}
      }
    }
    const coerced = coerce(spec, entry.value)
    if (!coerced.ok) return { ok: false, error: coerced.error, changed: [], changes: {} }
    changes[entry.key] = coerced.value
  }

  const read = readJsonFile(input.filePath)
  if (read.value === null) {
    return {
      ok: false,
      error: `现有配置文件无法解析，已拒绝写入以免破坏它：${read.error ?? '未知错误'}`,
      changed: [],
      changes: {}
    }
  }

  const next: Record<string, unknown> = { ...read.value }

  for (const [key, value] of Object.entries(changes)) {
    const path = key.split('.')
    if (value === null) deletePath(next, path)
    else setPath(next, path, value)
  }

  const written = writeJsonFile({
    filePath: input.filePath,
    value: next,
    indent: detectIndent(read.text),
    existed: read.exists
  })
  if (!written.ok) {
    return { ok: false, error: written.error, changed: [], changes: {} }
  }

  return { ok: true, target: input.filePath, changed: Object.keys(changes), changes }
}
