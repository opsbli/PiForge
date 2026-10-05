import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type { AgentEvent } from '../shared/agent-events'
import type { SessionSummary } from '../shared/ipc-types'
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
  /** 已有会话文件路径：传入则恢复该会话；不传则新建 */
  resumePath?: string
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
  const { cwd, bridge, resumePath } = options
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
  const settingsManager = sdk.SettingsManager.create(cwd, agentDir)

  // 注入危险操作审批扩展（内联，不走 ~/.pi/agent/extensions/）
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [
      { name: 'piforge-approval', factory: createApprovalExtension(cwd, bridge) },
      { name: 'piforge-memory', factory: createMemoryExtension(cwd) }
    ]
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

  return wrapSession(session, `${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`)
}

/** 列出历史会话 */
export async function listSessions(cwd: string): Promise<
  Array<{ id: string; path: string; name?: string; messageCount: number; modified: string; firstMessage: string }>
> {
  const sdk = await import('@earendil-works/pi-coding-agent')
  const infos = await sdk.SessionManager.list(cwd)
  return infos.map((info) => ({
    id: info.id,
    path: info.path,
    name: info.name,
    messageCount: info.messageCount,
    modified: info.modified.toISOString(),
    firstMessage: info.firstMessage
  }))
}

function wrapSession(session: AgentSession, modelLabel: string): SessionHandle {
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
