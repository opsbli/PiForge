import type {
  AgentSession,
  InlineExtension,
  LoadedMcpConfig,
  ResourceLoader,
  SettingsManager
} from '@earendil-works/pi-coding-agent'
import type { AgentEvent } from '../shared/agent-events'
import type { ResourcesSnapshot, SessionSummary, SessionHistoryMessage, ToolInfoLite } from '../shared/ipc-types'
import { buildResourcesSnapshot } from './resources-service'
import { loadMcpForSdk, mcpExtensionNeeds, mcpPaths } from './mcp-config'
import { createApprovalExtension, type ApprovalBridge } from './approval'
import { createMemoryExtension } from './memory'
import { builtinTools } from './tools'

export interface TreeEntry {
  id: string
  parentId: string | null
  type: string
  /** message 类型时的角色（user / assistant / tool） */
  role?: string
  /** 内容预览 */
  preview: string
  label?: string
  timestamp: string
  children: TreeEntry[]
}

export interface SessionHandle {
  /** 发送一条用户 prompt */
  send(text: string): Promise<void>
  /** 订阅映射后的前端事件 */
  onEvent(listener: (event: AgentEvent) => void): () => void
  /** 读取会话摘要（含 token / cost） */
  summary(): SessionSummary
  /** 会话文件路径（持久化模式） */
  sessionFile(): string | undefined
  /** 读取当前分支的历史消息（切换/恢复会话后回显用） */
  history(): SessionHistoryMessage[]
  /** 读取已加载资源快照（扩展 / skill / 上下文文件 / 诊断） */
  resources(): ResourcesSnapshot
  /**
   * 把已写入的设置应用到运行中的会话。
   * 只处理确实能立即生效的字段；返回确实已应用的键，其余交给重载路径。
   */
  applyLiveSettings(changes: Record<string, unknown>): string[]
  /** 重载会话：重读设置 + 重载资源 + 重建工具集 */
  reload(): Promise<void>
  /** 读取会话树（简化结构） */
  getTree(): TreeEntry[]
  /** 当前 leaf 节点 id */
  getLeafId(): string | null
  /** 导航到指定节点 */
  navigate(
    targetId: string,
    options: { summarize?: boolean; customInstructions?: string; label?: string }
  ): Promise<{ cancelled: boolean; editorText?: string }>
  /** 清理资源 */
  dispose(): void
}

/** 默认模型（DeepSeek）。可用 PI_MODEL_ID 覆盖。 */
const DEFAULT_PROVIDER = 'deepseek'
const DEFAULT_MODEL = process.env.PI_MODEL_ID ?? 'deepseek-flash'

export interface CreateSessionOptions {
  cwd: string
  bridge: ApprovalBridge
  /**
   * 与 agent 进程共享的设置管理器。
   * 必须由调用方创建并复用同一实例：设置中心写入后，运行中的会话要能立即读到新值。
   */
  settingsManager: SettingsManager
  /** 已有会话文件路径：传入则恢复该会话；不传则新建 */
  resumePath?: string
  /** 打开外部 URL（MCP 的 OAuth 登录用）；由 agent 进程转发给主进程 */
  openUrl?: (url: string) => void
}

/**
 * 创建/恢复一个 pi-agent 会话。
 *
 * 注意：`@earendil-works/pi-coding-agent` 是纯 ESM，而 Agent Utility Process
 * 被 electron-vite 构建为 CJS，所以这里用动态 `import()` 加载。
 *
 * 会话模式：默认**持久化**（SessionManager.create / open），便于会话恢复。
 * 需要临时会话时应传入 SessionManager.inMemory()。
 */
export async function createSession(options: CreateSessionOptions): Promise<SessionHandle> {
  const { cwd, bridge, settingsManager, resumePath, openUrl } = options
  const sdk = await import('@earendil-works/pi-coding-agent')

  // 模型/认证运行时：默认读 agentDir 下的 auth.json 与 models.json，
  // 但内置 DeepSeek provider 的 API Key 走环境变量 DEEPSEEK_API_KEY。
  const runtime = await sdk.ModelRuntime.create({ allowModelNetwork: false })
  const model = runtime.getModel(DEFAULT_PROVIDER, DEFAULT_MODEL)
  if (!model) {
    const available = runtime
      .getModels(DEFAULT_PROVIDER)
      .map((m) => m.id)
      .join(', ')
    throw new Error(
      `未找到模型 ${DEFAULT_PROVIDER}/${DEFAULT_MODEL}。该 provider 可用模型：${available || '(无)'}`
    )
  }

  const agentDir = sdk.getAgentDir()

  // 注入危险操作审批扩展（内联，不走 ~/.pi/agent/extensions/）
  const extensionFactories: InlineExtension[] = [
    { name: 'piforge-approval', factory: createApprovalExtension(cwd, bridge) },
    { name: 'piforge-memory', factory: createMemoryExtension(cwd) }
  ]

  // MCP：SDK 会话**不会**自动加载内置扩展（SDK 文档原文），必须显式注入。
  // codemode / tool-search 只在确实有对应 exposure 的服务器时才挂，
  // 否则会改变没有 MCP 时的工具面。
  const mcpConfig = loadMcpForSdk({ cwd, agentDir, projectTrusted: settingsManager.isProjectTrusted() })
  extensionFactories.push({
    name: 'piforge-mcp',
    factory: sdk.createMcpExtension({
      // 自实现的加载器按官方文档格式构造条目并逐条校验过，形状与 McpServerConfig 一致；
      // SDK 未导出 validateMcpServerConfig，无法借它做编译期窄化，故在此断言。
      loadConfig: () =>
        loadMcpForSdk({
          cwd,
          agentDir,
          projectTrusted: settingsManager.isProjectTrusted()
        }) as unknown as LoadedMcpConfig,
      ...(openUrl ? { openUrl } : {}),
      logPath: mcpPaths(cwd, agentDir).logPath
    })
  })

  const needs = mcpExtensionNeeds(mcpConfig)
  if (needs.codemode) {
    extensionFactories.push({ name: 'piforge-codemode', factory: sdk.createCodemodeExtension() })
  }
  if (needs.toolSearch) {
    extensionFactories.push({
      name: 'piforge-tool-search',
      factory: sdk.createToolSearchExtension()
    })
  }

  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories
  })
  await resourceLoader.reload()

  // 持久化：恢复已有会话或新建
  const sessionManager = resumePath
    ? sdk.SessionManager.open(resumePath)
    : sdk.SessionManager.create(cwd)

  const { session } = await sdk.createAgentSession({
    cwd,
    agentDir,
    modelRuntime: runtime,
    model,
    settingsManager,
    resourceLoader,
    // 静态内置工具（Git 集成 / 项目信息 / TODO 搜索 / 行数统计）
    customTools: builtinTools,
    // 默认持久化（非 inMemory）
    sessionManager
  })

  return wrapSession(session, `${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`, resourceLoader)
}

/** 列出历史会话（当前工作目录） */
export async function listSessions(cwd: string): Promise<
  Array<{ id: string; path: string; name?: string; cwd: string; messageCount: number; modified: string; firstMessage: string }>
> {
  const sdk = await import('@earendil-works/pi-coding-agent')
  const infos = await sdk.SessionManager.list(cwd)
  return infos.map(toSessionItem)
}

/** 跨工作目录列出全部历史会话（每项带 cwd，供 UI 按项目分组） */
export async function listAllSessions(): Promise<
  Array<{ id: string; path: string; name?: string; cwd: string; messageCount: number; modified: string; firstMessage: string }>
> {
  const sdk = await import('@earendil-works/pi-coding-agent')
  const infos = await sdk.SessionManager.listAll()
  return infos.map(toSessionItem)
}

function toSessionItem(info: {
  id: string
  path: string
  name?: string
  cwd?: string
  messageCount: number
  modified: Date
  firstMessage: string
}): { id: string; path: string; name?: string; cwd: string; messageCount: number; modified: string; firstMessage: string } {
  return {
    id: info.id,
    path: info.path,
    name: info.name,
    cwd: info.cwd ?? '',
    messageCount: info.messageCount,
    modified: info.modified.toISOString(),
    firstMessage: info.firstMessage
  }
}

function wrapSession(
  session: AgentSession,
  modelLabel: string,
  resourceLoader: ResourceLoader
): SessionHandle {
  return {
    async send(text: string): Promise<void> {
      await session.prompt(text)
    },

    onEvent(listener: (event: AgentEvent) => void): () => void {
      const unsubscribe = session.subscribe((event) => {
        const mapped = mapEvent(event)
        if (mapped) listener(mapped)
      })
      return unsubscribe
    },

    summary(): SessionSummary {
      const stats = session.getSessionStats()
      return {
        sessionId: stats.sessionId,
        model: modelLabel,
        messageCount: stats.totalMessages,
        tokenUsage: {
          input: stats.tokens.input,
          output: stats.tokens.output,
          cacheRead: stats.tokens.cacheRead,
          cacheWrite: stats.tokens.cacheWrite,
          total: stats.tokens.total
        },
        cost: stats.cost
      }
    },

    sessionFile(): string | undefined {
      return session.getSessionStats().sessionFile
    },

    history(): SessionHistoryMessage[] {
      return buildHistory(session.sessionManager)
    },

    resources(): ResourcesSnapshot {
      return buildResourcesSnapshot(resourceLoader, collectTools(session))
    },

    applyLiveSettings(changes: Record<string, unknown>): string[] {
      const applied: string[] = []

      // 立即生效失败不当作错误：值已写入文件，后续重载会接上
      const attempt = (key: string, apply: () => void): void => {
        try {
          apply()
          applied.push(key)
        } catch {
          // 交给重载路径
        }
      }

      const thinkingLevel = changes.defaultThinkingLevel
      if (typeof thinkingLevel === 'string') {
        attempt('defaultThinkingLevel', () =>
          session.setThinkingLevel(thinkingLevel as Parameters<typeof session.setThinkingLevel>[0])
        )
      }

      const compactionEnabled = changes['compaction.enabled']
      if (typeof compactionEnabled === 'boolean') {
        attempt('compaction.enabled', () => session.setAutoCompactionEnabled(compactionEnabled))
      }

      const retryEnabled = changes['retry.enabled']
      if (typeof retryEnabled === 'boolean') {
        attempt('retry.enabled', () => session.setAutoRetryEnabled(retryEnabled))
      }

      const steeringMode = changes.steeringMode
      if (typeof steeringMode === 'string') {
        attempt('steeringMode', () =>
          session.setSteeringMode(steeringMode as Parameters<typeof session.setSteeringMode>[0])
        )
      }

      const followUpMode = changes.followUpMode
      if (typeof followUpMode === 'string') {
        attempt('followUpMode', () =>
          session.setFollowUpMode(followUpMode as Parameters<typeof session.setFollowUpMode>[0])
        )
      }

      const cacheWarming = changes.cacheWarming
      if (typeof cacheWarming === 'string') {
        attempt('cacheWarming', () =>
          session.setCacheWarmingMode(cacheWarming as Parameters<typeof session.setCacheWarmingMode>[0])
        )
      }

      return applied
    },

    async reload(): Promise<void> {
      await session.reload()
    },

    getTree(): TreeEntry[] {
      const manager = session.sessionManager
      const roots = manager.getTree()
      return roots.map((node) => toTreeEntry(node))
    },

    getLeafId(): string | null {
      return session.sessionManager.getLeafId()
    },

    async navigate(targetId, options) {
      const result = await session.navigateTree(targetId, options)
      return { cancelled: result.cancelled, editorText: result.editorText }
    },

    dispose(): void {
      session.dispose()
    }
  }
}

// 放在 session 层，避免 index.ts 直接依赖 events 的细节
import { mapSdkEvent as mapEvent } from './events'

/** 把 SDK 的 SessionTreeNode 递归转成精简结构（给 UI） */
function toTreeEntry(node: {
  entry: { type: string; id: string; parentId: string | null; timestamp: string; message?: unknown; summary?: string }
  children: unknown[]
  label?: string
}): TreeEntry {
  const e = node.entry
  let role: string | undefined
  let preview = ''
  if (e.type === 'message' && e.message) {
    const msg = e.message as { role?: string; content?: unknown }
    role = msg.role
    preview = previewOf(msg.content)
  } else if (e.type === 'compaction') {
    preview = `[压缩摘要] ${(e.summary ?? '').slice(0, 80)}`
  } else {
    preview = `[${e.type}]`
  }
  return {
    id: e.id,
    parentId: e.parentId,
    type: e.type,
    role,
    preview,
    label: node.label,
    timestamp: e.timestamp,
    children: (node.children as Parameters<typeof toTreeEntry>[0][]).map((c) => toTreeEntry(c))
  }
}

function previewOf(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 80)
  if (Array.isArray(content)) {
    const texts = content
      .filter((c) => c && typeof c === 'object' && (c as { type?: string }).type === 'text')
      .map((c) => String((c as { text?: string }).text ?? ''))
    const toolCalls = content.filter(
      (c) => c && typeof c === 'object' && (c as { type?: string }).type === 'toolCall'
    )
    const joined = texts.join(' ').trim()
    if (joined) return joined.slice(0, 80)
    if (toolCalls.length > 0) return `[工具调用 x${toolCalls.length}]`
  }
  return '(空)'
}

/** 单条工具结果保留的最大字符数（避免历史回显把巨型输出拉进渲染进程） */
const HISTORY_RESULT_LIMIT = 4000

interface RawToolInfo {
  name: string
  description?: string
  exposure?: string
  sourceInfo?: { path?: string }
}

/** MCP 工具名为 `mcp__<server>__<tool>`（见 SDK 的 docs/mcp.md），服务器名从这里取出 */
function mcpServerOf(toolName: string): string | null {
  const prefix = 'mcp__'
  if (!toolName.startsWith(prefix)) return null
  const rest = toolName.slice(prefix.length)
  const separator = rest.indexOf('__')
  return separator > 0 ? rest.slice(0, separator) : rest
}

function collectTools(session: AgentSession): ToolInfoLite[] {
  const active = new Set(session.getActiveToolNames())
  const tools = session.getAllTools() as unknown as RawToolInfo[]

  return tools.map((tool) => {
    const server = mcpServerOf(tool.name)
    const builtin = Boolean(tool.sourceInfo?.path?.startsWith('builtin:'))
    return {
      name: tool.name,
      description: tool.description ?? '',
      origin: server ? 'mcp' : builtin ? 'builtin' : 'extension',
      server,
      exposure: tool.exposure ?? '',
      active: active.has(tool.name)
    }
  })
}

interface RawTreeNode {
  entry: {
    type: string
    id: string
    parentId: string | null
    timestamp?: string
    message?: unknown
    summary?: string
  }
  children: RawTreeNode[]
  label?: string
}

/**
 * 重建会话历史（供切换/恢复会话后回显）。
 *
 * 只取「根 → 当前 leaf」这一条活动分支，与 navigateTree 的语义一致：
 * 被放弃的分支不会混进当前对话。assistant 的 thinking 块不展示，
 * 工具结果通过 toolCallId 回填到对应的 toolCall 上。
 */
function buildHistory(manager: unknown): SessionHistoryMessage[] {
  const branch = activeBranch(manager)
  if (branch.length === 0) return []

  const results = collectToolResults(branch)
  const messages: SessionHistoryMessage[] = []

  for (const node of branch) {
    // 分支/压缩摘要不是对话消息，但已进入 agent 上下文，单独成条展示
    if (node.entry.type === 'branch_summary' || node.entry.type === 'compaction') {
      const text = (node.entry.summary ?? '').trim()
      if (text) {
        messages.push({
          id: node.entry.id,
          role: 'note',
          title: node.entry.type === 'compaction' ? '上下文压缩摘要' : '分支摘要',
          text: truncateResult(text)
        })
      }
      continue
    }

    if (node.entry.type !== 'message') continue
    const message = node.entry.message as { role?: string; content?: unknown } | undefined
    if (!message?.role) continue

    if (message.role === 'user') {
      const text = textOfContent(message.content)
      if (text) messages.push({ id: node.entry.id, role: 'user', text })
      continue
    }

    // toolResult 已在 collectToolResults 中消费，不单独成条
    if (message.role !== 'assistant') continue

    const text = textOfContent(message.content)
    if (text) messages.push({ id: node.entry.id, role: 'assistant', text })

    const blocks = Array.isArray(message.content) ? message.content : []
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue
      const call = block as { type?: string; id?: string; name?: string; arguments?: unknown }
      if (call.type !== 'toolCall' || !call.id) continue

      const result = results.get(call.id)
      messages.push({
        id: `${node.entry.id}:${call.id}`,
        role: 'tool',
        callId: call.id,
        tool: call.name ?? 'unknown',
        args: call.arguments,
        status: result && !result.isError ? 'ok' : 'error',
        result: result ? truncateResult(result.text) : undefined,
        error: result
          ? result.isError
            ? truncateResult(result.text) || '工具执行失败'
            : undefined
          : '没有记录到该工具调用的结果（会话中断或该分支已切换）'
      })
    }
  }

  return messages
}

/** 从 leaf 沿 parentId 上溯到根，再反转成时间顺序 */
function activeBranch(manager: unknown): RawTreeNode[] {
  const sessionManager = manager as {
    getTree: () => RawTreeNode[]
    getLeafId: () => string | null
  }

  const byId = new Map<string, RawTreeNode>()
  const collect = (nodes: RawTreeNode[]): void => {
    for (const node of nodes) {
      byId.set(node.entry.id, node)
      collect(node.children)
    }
  }
  collect(sessionManager.getTree())

  const leafId = sessionManager.getLeafId()
  if (!leafId) return []

  const chain: RawTreeNode[] = []
  let current = byId.get(leafId)
  while (current) {
    chain.push(current)
    const parentId = current.entry.parentId
    current = parentId ? byId.get(parentId) : undefined
  }

  return chain.reverse()
}

function collectToolResults(
  branch: RawTreeNode[]
): Map<string, { isError: boolean; text: string }> {
  const results = new Map<string, { isError: boolean; text: string }>()

  for (const node of branch) {
    if (node.entry.type !== 'message') continue
    const message = node.entry.message as
      | { role?: string; toolCallId?: string; content?: unknown; isError?: boolean }
      | undefined
    if (message?.role !== 'toolResult' || !message.toolCallId) continue
    results.set(message.toolCallId, {
      isError: Boolean(message.isError),
      text: textOfContent(message.content)
    })
  }

  return results
}

/** 只拼接 text 块，忽略 thinking / toolCall 等非文本块 */
function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .filter((block) => block && typeof block === 'object' && (block as { type?: string }).type === 'text')
    .map((block) => String((block as { text?: string }).text ?? ''))
    .join('\n')
    .trim()
}

function truncateResult(text: string): string {
  if (text.length <= HISTORY_RESULT_LIMIT) return text
  return `${text.slice(0, HISTORY_RESULT_LIMIT)}\n\n…（历史回显已截断，原始长度 ${text.length} 字符）`
}
