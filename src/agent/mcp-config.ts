import { join } from 'node:path'
import type {
  McpConfigResult,
  McpConfigView,
  McpExposureName,
  McpScopeNameRequest,
  McpPatchRequest,
  McpServerInput,
  McpServerView,
  McpTransportKind,
  McpUpsertRequest
} from '../shared/ipc-types'
import { detectIndent, readJsonFile, writeJsonFile } from './json-file'

/**
 * MCP 配置（mcp.json）的读取与写入。
 *
 * 为什么自己实现：SDK 的 `loadMcpConfig` / `addMcpServerConfig` / `removeMcpServerConfig` /
 * `updateMcpServerConfig` / `validateMcpServerConfig` **都不在包的根导出里**，而深路径导入
 * 被 exports 封死（实测 `ERR_PACKAGE_PATH_NOT_EXPORTED`）。格式是公开稳定的，因此自行实现。
 *
 * 格式与合并语义依官方文档 docs/mcp.md：
 * - 用户级 `~/.pi/agent/mcp.json`、项目级 `<cwd>/.pi/mcp.json`，共用 `mcpServers` 形状
 * - 项目条目取代同名用户级条目；但**不带 command/url/type 的项目条目只覆盖
 *   enabled / exposure / toolExposure**，其余（含 env、headers、auth）沿用用户级
 * - 同名判定不区分 `-` 与 `_`；`sse` 不支持；type 只能是 stdio / http / streamable-http
 */

const NAME_PATTERN = /^[A-Za-z0-9_-]+$/
const EXPOSURES: McpExposureName[] = ['codemode', 'deferred', 'direct', 'hidden']
const TRANSPORT_TYPES = ['stdio', 'http', 'streamable-http']

interface RawServerConfig {
  type?: unknown
  command?: unknown
  args?: unknown
  env?: unknown
  cwd?: unknown
  url?: unknown
  headers?: unknown
  timeout?: unknown
  enabled?: unknown
  exposure?: unknown
  description?: unknown
  oauth?: unknown
  auth?: unknown
  toolExposure?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** 同名判定：`-` 与 `_` 视为等价（文档规定） */
function normalizeName(name: string): string {
  return name.replace(/-/g, '_').toLowerCase()
}

function readServers(filePath: string): {
  servers: Array<{ name: string; raw: RawServerConfig }>
  autoEnableCodemode: boolean | null
  error: string | null
} {
  const read = readJsonFile(filePath)
  if (read.value === null) {
    return { servers: [], autoEnableCodemode: null, error: `${filePath} 无法解析：${read.error}` }
  }
  const container = asRecord(read.value.mcpServers)
  const servers = Object.entries(container).map(([name, raw]) => ({
    name,
    raw: asRecord(raw) as RawServerConfig
  }))
  const auto = read.value.autoEnableCodemode
  return {
    servers,
    autoEnableCodemode: typeof auto === 'boolean' ? auto : null,
    error: null
  }
}

/** 按文档规则校验单个条目；返回错误字符串或 null */
function validateServer(name: string, raw: RawServerConfig): string | null {
  if (!NAME_PATTERN.test(name)) {
    return `名称只能包含字母、数字、_ 和 -（当前：${name}）`
  }
  if (typeof raw.type === 'string' && !TRANSPORT_TYPES.includes(raw.type)) {
    return `type 只能是 ${TRANSPORT_TYPES.join(' / ')}`
  }
  if (raw.type === 'sse') return '不支持 sse 传输，请改用 streamable HTTP'

  const hasCommand = typeof raw.command === 'string' && raw.command.length > 0
  const hasUrl = typeof raw.url === 'string' && raw.url.length > 0
  if (hasCommand && hasUrl) return 'command 与 url 只能二选一'
  // 合并后仍没有 endpoint，说明这是一个没有对应用户级服务器的「仅覆盖开关」条目，
  // 拿它去连接注定失败，因此判为非法而不是放行。
  if (!hasCommand && !hasUrl) {
    return '必须提供 command（stdio）或 url（http）；只覆盖开关的项目级条目需要存在同名用户级服务器'
  }

  if (typeof raw.exposure === 'string' && !EXPOSURES.includes(raw.exposure as McpExposureName)) {
    return `exposure 只能是 ${EXPOSURES.join(' / ')}`
  }
  if (raw.timeout !== undefined && typeof raw.timeout !== 'number') return 'timeout 必须是数字'
  return null
}

function toView(input: {
  name: string
  raw: RawServerConfig
  scope: McpServerView['source']
  sourcePath: string
  overrideOf: string | null
}): McpServerView {
  const { name, raw, scope, sourcePath, overrideOf } = input
  const hasCommand = typeof raw.command === 'string' && raw.command.length > 0
  const transport: McpTransportKind = hasCommand ? 'stdio' : 'http'
  const exposure = EXPOSURES.includes(raw.exposure as McpExposureName)
    ? (raw.exposure as McpExposureName)
    : 'codemode'

  return {
    name,
    transport,
    command: hasCommand ? (raw.command as string) : null,
    args: asStringArray(raw.args),
    envKeys: Object.keys(asRecord(raw.env)),
    cwd: typeof raw.cwd === 'string' ? raw.cwd : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    headerKeys: Object.keys(asRecord(raw.headers)),
    timeout: typeof raw.timeout === 'number' ? raw.timeout : null,
    enabled: raw.enabled !== false,
    exposure,
    description: typeof raw.description === 'string' ? raw.description : null,
    source: scope,
    sourcePath,
    overrideOf,
    error: validateServer(name, raw)
  }
}

export function mcpPaths(cwd: string, agentDir: string): {
  globalPath: string
  projectPath: string
  authPath: string
  logPath: string
} {
  return {
    globalPath: join(agentDir, 'mcp.json'),
    projectPath: join(cwd, '.pi', 'mcp.json'),
    authPath: join(agentDir, 'mcp-auth.json'),
    logPath: join(agentDir, 'mcp.log')
  }
}

/** 合并后的条目（保留完整原始值，不脱敏） */
interface MergedEntry {
  name: string
  raw: RawServerConfig
  scope: 'global' | 'project'
  sourcePath: string
  overrideOf: string | null
}

/** 按文档规则合并用户级与项目级条目 */
function mergeEntries(input: {
  global: Array<{ name: string; raw: RawServerConfig }>
  project: Array<{ name: string; raw: RawServerConfig }>
  globalPath: string
  projectPath: string
}): MergedEntry[] {
  const projectByName = new Map(input.project.map((entry) => [normalizeName(entry.name), entry]))
  const merged: MergedEntry[] = []
  const consumed = new Set<string>()

  for (const entry of input.global) {
    const projectEntry = projectByName.get(normalizeName(entry.name))
    if (!projectEntry) {
      merged.push({
        name: entry.name,
        raw: entry.raw,
        scope: 'global',
        sourcePath: input.globalPath,
        overrideOf: null
      })
      continue
    }

    consumed.add(normalizeName(projectEntry.name))
    const projectHasEndpoint =
      (typeof projectEntry.raw.command === 'string' && projectEntry.raw.command.length > 0) ||
      (typeof projectEntry.raw.url === 'string' && projectEntry.raw.url.length > 0) ||
      typeof projectEntry.raw.type === 'string'

    merged.push({
      name: projectEntry.name,
      // 带 endpoint 的项目条目整体取代；否则只覆盖 enabled / exposure
      raw: projectHasEndpoint
        ? projectEntry.raw
        : {
            ...entry.raw,
            ...(projectEntry.raw.enabled === undefined ? {} : { enabled: projectEntry.raw.enabled }),
            ...(projectEntry.raw.exposure === undefined
              ? {}
              : { exposure: projectEntry.raw.exposure })
          },
      scope: 'project',
      sourcePath: input.projectPath,
      overrideOf: entry.name
    })
  }

  for (const entry of input.project) {
    if (consumed.has(normalizeName(entry.name))) continue
    merged.push({
      name: entry.name,
      raw: entry.raw,
      scope: 'project',
      sourcePath: input.projectPath,
      overrideOf: null
    })
  }

  return merged
}

/**
 * 给 SDK 的 MCP 扩展用的加载器。
 *
 * 与 `readMcpConfig` 的关键区别：这里**保留 env / headers 的值**，
 * 因为扩展需要它们才能真正连上服务器。只有面向渲染进程的视图会脱敏。
 */
export function loadMcpForSdk(input: {
  cwd: string
  agentDir: string
  projectTrusted: boolean
}): {
  servers: Array<{
    name: string
    config: Record<string, unknown>
    source: string
    scope: 'global' | 'project'
    override?: string
  }>
  autoEnableCodemode?: boolean
  errors: string[]
  projectConfig?: string
} {
  const paths = mcpPaths(input.cwd, input.agentDir)
  const errors: string[] = []

  const global = readServers(paths.globalPath)
  if (global.error) errors.push(global.error)
  const project = input.projectTrusted
    ? readServers(paths.projectPath)
    : { servers: [], autoEnableCodemode: null, error: null }
  if (project.error) errors.push(project.error)

  const merged = mergeEntries({
    global: global.servers,
    project: project.servers,
    globalPath: paths.globalPath,
    projectPath: paths.projectPath
  })

  const servers: Array<{
    name: string
    config: Record<string, unknown>
    source: string
    scope: 'global' | 'project'
    override?: string
  }> = []

  for (const entry of merged) {
    const error = validateServer(entry.name, entry.raw)
    if (error) {
      errors.push(`${entry.name}: ${error}`)
      continue
    }
    servers.push({
      name: entry.name,
      config: entry.raw as Record<string, unknown>,
      source: entry.sourcePath,
      scope: entry.scope,
      ...(entry.overrideOf ? { override: entry.overrideOf } : {})
    })
  }

  const auto = project.autoEnableCodemode ?? global.autoEnableCodemode
  return {
    servers,
    ...(auto === null ? {} : { autoEnableCodemode: auto }),
    errors,
    ...(input.projectTrusted ? { projectConfig: paths.projectPath } : {})
  }
}

/** 是否需要 codemode / tool-search 扩展（依 exposure 决定） */
export function mcpExtensionNeeds(config: ReturnType<typeof loadMcpForSdk>): {
  codemode: boolean
  toolSearch: boolean
} {
  let codemode = false
  let toolSearch = false

  for (const server of config.servers) {
    const raw = server.config as RawServerConfig
    if (raw.enabled === false) continue
    const exposure = EXPOSURES.includes(raw.exposure as McpExposureName)
      ? (raw.exposure as McpExposureName)
      : 'codemode'
    if (exposure === 'codemode') codemode = true
    if (exposure === 'deferred') toolSearch = true

    const perTool = asRecord(raw.toolExposure)
    for (const value of Object.values(perTool)) {
      if (value === 'codemode') codemode = true
      if (value === 'deferred') toolSearch = true
    }
  }

  return { codemode, toolSearch }
}

export function readMcpConfig(input: {
  cwd: string
  agentDir: string
  projectTrusted: boolean
}): McpConfigView {
  const paths = mcpPaths(input.cwd, input.agentDir)
  const errors: string[] = []

  const global = readServers(paths.globalPath)
  if (global.error) errors.push(global.error)

  const project = input.projectTrusted
    ? readServers(paths.projectPath)
    : { servers: [], autoEnableCodemode: null, error: null }
  if (project.error) errors.push(project.error)

  const merged = mergeEntries({
    global: global.servers,
    project: project.servers,
    globalPath: paths.globalPath,
    projectPath: paths.projectPath
  })

  const views: McpServerView[] = merged.map((entry) =>
    toView({
      name: entry.name,
      raw: entry.raw,
      scope: entry.scope,
      sourcePath: entry.sourcePath,
      overrideOf: entry.overrideOf
    })
  )

  views.sort((a, b) => a.name.localeCompare(b.name))

  return {
    servers: views,
    autoEnableCodemode: project.autoEnableCodemode ?? global.autoEnableCodemode,
    errors,
    globalPath: paths.globalPath,
    projectPath: paths.projectPath,
    projectTrusted: input.projectTrusted,
    authPath: paths.authPath,
    logPath: paths.logPath
  }
}

/* --------------------------- 写入 --------------------------- */

/**
 * 把界面输入转成 mcp.json 条目。
 * `env` / `headers` 仅在显式提供时写入，避免「只改 exposure」把凭据清空。
 */
function toRawConfig(input: McpServerInput, existing: RawServerConfig | null): RawServerConfig {
  const next: RawServerConfig = existing ? { ...existing } : {}

  if (input.transport === 'stdio') {
    next.command = input.command ?? ''
    if (input.args && input.args.length > 0) next.args = input.args
    else delete next.args
    if (input.cwd) next.cwd = input.cwd
    else delete next.cwd
    delete next.url
    delete next.headers
    delete next.oauth
    delete next.auth
  } else {
    next.url = input.url ?? ''
    if (input.headers) next.headers = input.headers
    delete next.command
    delete next.args
    delete next.cwd
    delete next.env
  }

  if (input.env) next.env = input.env
  if (input.timeout !== undefined) next.timeout = input.timeout
  if (input.exposure) next.exposure = input.exposure
  if (input.description) next.description = input.description
  if (input.enabled !== undefined) next.enabled = input.enabled

  return next
}

function persist(filePath: string, value: Record<string, unknown>): { ok: boolean; error?: string } {
  const read = readJsonFile(filePath)
  if (read.value === null) {
    return { ok: false, error: `${filePath} 无法解析，已拒绝写入以免破坏它：${read.error}` }
  }
  return writeJsonFile({
    filePath,
    value,
    indent: detectIndent(read.text),
    existed: read.exists
  })
}

function configFor(
  input: { cwd: string; agentDir: string; projectTrusted: boolean },
  error?: string
): McpConfigResult {
  return { ok: !error, error, config: readMcpConfig(input) }
}

export function upsertMcpServer(
  request: McpUpsertRequest,
  context: { cwd: string; agentDir: string; projectTrusted: boolean }
): McpConfigResult {
  const name = request.name.trim()
  if (!NAME_PATTERN.test(name)) {
    return configFor(context, '名称只能包含字母、数字、_ 和 -')
  }
  if (request.scope === 'project' && !context.projectTrusted) {
    return configFor(context, '项目未被信任，已拒绝写入项目级 mcp.json')
  }

  const paths = mcpPaths(context.cwd, context.agentDir)
  const filePath = request.scope === 'global' ? paths.globalPath : paths.projectPath

  const read = readJsonFile(filePath)
  if (read.value === null) {
    return configFor(context, `${filePath} 无法解析，已拒绝写入以免破坏它：${read.error}`)
  }

  const container = { ...asRecord(read.value.mcpServers) }
  const existingRaw = container[name] === undefined ? null : (asRecord(container[name]) as RawServerConfig)
  const raw = toRawConfig(request.config, existingRaw)

  if (request.config.transport === 'stdio' && !raw.command) {
    return configFor(context, 'stdio 服务器必须提供 command')
  }
  if (request.config.transport === 'http' && !raw.url) {
    return configFor(context, 'HTTP 服务器必须提供 url')
  }

  const validationError = validateServer(name, raw)
  if (validationError) return configFor(context, validationError)

  container[name] = raw
  const persisted = persist(filePath, { ...read.value, mcpServers: container })
  return configFor(context, persisted.ok ? undefined : persisted.error)
}

export function removeMcpServer(
  request: McpScopeNameRequest,
  context: { cwd: string; agentDir: string; projectTrusted: boolean }
): McpConfigResult {
  if (request.scope === 'project' && !context.projectTrusted) {
    return configFor(context, '项目未被信任，已拒绝修改项目级 mcp.json')
  }

  const paths = mcpPaths(context.cwd, context.agentDir)
  const filePath = request.scope === 'global' ? paths.globalPath : paths.projectPath

  const read = readJsonFile(filePath)
  if (read.value === null) {
    return configFor(context, `${filePath} 无法解析，已拒绝写入以免破坏它：${read.error}`)
  }

  const container = { ...asRecord(read.value.mcpServers) }
  if (container[request.name] === undefined) {
    return configFor(context, `该文件中没有名为 ${request.name} 的服务器`)
  }
  delete container[request.name]

  const persisted = persist(filePath, { ...read.value, mcpServers: container })
  return configFor(context, persisted.ok ? undefined : persisted.error)
}

export function patchMcpServer(
  request: McpPatchRequest,
  context: { cwd: string; agentDir: string; projectTrusted: boolean }
): McpConfigResult {
  if (request.scope === 'project' && !context.projectTrusted) {
    return configFor(context, '项目未被信任，已拒绝修改项目级 mcp.json')
  }

  const paths = mcpPaths(context.cwd, context.agentDir)
  const filePath = request.scope === 'global' ? paths.globalPath : paths.projectPath

  const read = readJsonFile(filePath)
  if (read.value === null) {
    return configFor(context, `${filePath} 无法解析，已拒绝写入以免破坏它：${read.error}`)
  }

  const container = { ...asRecord(read.value.mcpServers) }
  const current = container[request.name]

  // 目标条目不存在时，按文档把「只有开关」的项目级条目作为覆盖写入用户级服务器
  if (current === undefined && request.scope === 'project') {
    container[request.name] = {
      ...(request.enabled === undefined ? {} : { enabled: request.enabled }),
      ...(request.exposure === undefined ? {} : { exposure: request.exposure })
    }
  } else if (current === undefined) {
    return configFor(context, `该文件中没有名为 ${request.name} 的服务器`)
  } else {
    const next = { ...(asRecord(current) as RawServerConfig) }
    if (request.enabled !== undefined) next.enabled = request.enabled
    if (request.exposure !== undefined) next.exposure = request.exposure
    container[request.name] = next
  }

  const value: Record<string, unknown> = { ...read.value, mcpServers: container }
  if (request.autoEnableCodemode !== undefined) {
    value.autoEnableCodemode = request.autoEnableCodemode
  }

  const persisted = persist(filePath, value)
  return configFor(context, persisted.ok ? undefined : persisted.error)
}
