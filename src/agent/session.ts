import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type { AgentEvent } from '../shared/agent-events'
import type { SessionSummary } from '../shared/ipc-types'
import { createApprovalExtension, type ApprovalBridge } from './approval'

export interface SessionHandle {
  /** 发送一条用户 prompt */
  send(text: string): Promise<void>
  /** 订阅映射后的前端事件 */
  onEvent(listener: (event: AgentEvent) => void): () => void
  /** 读取会话摘要 */
  summary(): SessionSummary
  /** 清理资源 */
  dispose(): void
}

/** 默认模型（DeepSeek）。可用 PI_MODEL_ID 覆盖。 */
const DEFAULT_PROVIDER = 'deepseek'
const DEFAULT_MODEL = process.env.PI_MODEL_ID ?? 'deepseek-flash'

/**
 * 创建一个 pi-agent 会话。
 *
 * 注意：`@earendil-works/pi-coding-agent` 是纯 ESM，而 Agent Utility Process
 * 被 electron-vite 构建为 CJS，所以这里用动态 `import()` 加载。
 *
 * 会话模式：默认**持久化**（SessionManager.create(cwd)），便于会话恢复。
 * 需要临时会话时应传入 SessionManager.inMemory()。
 */
export async function createSession(cwd: string, bridge: ApprovalBridge): Promise<SessionHandle> {
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
      { name: 'piforge-approval', factory: createApprovalExtension(cwd, bridge) }
    ]
  })
  await resourceLoader.reload()

  const { session } = await sdk.createAgentSession({
    cwd,
    agentDir,
    modelRuntime: runtime,
    model,
    settingsManager,
    resourceLoader,
    // 默认持久化（非 inMemory）
    sessionManager: sdk.SessionManager.create(cwd)
  })

  return wrapSession(session)
}

function wrapSession(session: AgentSession): SessionHandle {
  let inputTokens = 0
  let outputTokens = 0

  return {
    async send(text: string): Promise<void> {
      await session.prompt(text)
    },

    onEvent(listener: (event: AgentEvent) => void): () => void {
      const unsubscribe = session.subscribe((event) => {
        // 累计 token（若事件里带 usage）
        const e = event as Record<string, any>
        const usage = e.message?.usage
        if (usage) {
          inputTokens = Math.max(inputTokens, usage.input ?? usage.promptTokens ?? 0)
          outputTokens = Math.max(outputTokens, usage.output ?? usage.completionTokens ?? 0)
        }
        const mapped = mapEvent(event)
        if (mapped) listener(mapped)
      })
      return unsubscribe
    },

    summary(): SessionSummary {
      return {
        sessionId: (session as unknown as { id?: string }).id ?? 'current',
        model: `${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`,
        messageCount: session.messages.length,
        tokenUsage: { input: inputTokens, output: outputTokens },
        cost: 0
      }
    },

    dispose(): void {
      session.dispose()
    }
  }
}

// 放在 session 层，避免 index.ts 直接依赖 events 的细节
import { mapSdkEvent as mapEvent } from './events'
