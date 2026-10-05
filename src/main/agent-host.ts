import { utilityProcess, type UtilityProcess, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc-types'
import type {
  ApprovalMode,
  SessionSummary,
  SessionListItem,
  SessionHistoryMessage,
  SessionMeta,
  ModelListItem,
  ProviderTemplate,
  SettingsSnapshot,
  SettingsReloadResult,
  SettingsWriteRequest,
  SettingsWriteResult,
  PackageActionRequest,
  PackageProgress,
  PackageResult,
  McpConfigResult,
  McpPatchRequest,
  McpScopeNameRequest,
  McpUpsertRequest,
  ResourcesSnapshot,
  TrustSnapshot,
  TrustWriteRequest,
  TrustWriteResult,
  ApprovalRequest,
  TreeEntry
} from '../shared/ipc-types'
import type { AgentEvent } from '../shared/agent-events'
import { resolveApiKey } from './credentials'
import { beginTrace, endTrace, recordToolSpan, getStats } from './trace-store'

type AgentOutbound =
  | { type: 'ready'; agentDir?: string }
  | { type: 'event'; event: AgentEvent }
  | { type: 'summary'; requestId: string; summary: SessionSummary }
  | { type: 'approval_request'; requestId: string; request: ApprovalRequest }
  | { type: 'session_list_result'; requestId: string; sessions: SessionListItem[] }
  | { type: 'session_list_all_result'; requestId: string; sessions: SessionListItem[] }
  | { type: 'session_meta_result'; requestId: string; meta: SessionMeta }
  | { type: 'model_list_result'; requestId: string; models: ModelListItem[]; current: { providerId: string; modelId: string } }
  | { type: 'provider_templates_result'; requestId: string; templates: ProviderTemplate[] }
  | { type: 'session_messages_result'; requestId: string; messages: SessionHistoryMessage[] }
  | { type: 'settings_snapshot'; requestId: string; snapshot: SettingsSnapshot }
  | { type: 'settings_write_result'; requestId: string; result: SettingsWriteResult }
  | { type: 'settings_reload_result'; requestId: string; result: SettingsReloadResult }
  | { type: 'packages_progress'; progress: PackageProgress }
  | { type: 'packages_result'; requestId: string; result: PackageResult }
  | { type: 'mcp_config_result'; requestId: string; result: McpConfigResult }
  | { type: 'mcp_open_url'; url: string }
  | { type: 'resources_snapshot'; requestId: string; snapshot: ResourcesSnapshot }
  | { type: 'trust_snapshot'; requestId: string; snapshot: TrustSnapshot }
  | { type: 'trust_write_result'; requestId: string; result: TrustWriteResult }
  | { type: 'tree_result'; requestId: string; tree: TreeEntry[]; leafId: string | null }
  | { type: 'error'; message: string }

/**
 * 主进程侧的 Agent Utility Process 管理器。
 *
 * 只负责：spawn / 生命周期 / 消息转发。不直接执行 Agent 逻辑。
 */
export class AgentHost {
  private child: UtilityProcess | null = null
  private ready = false
  private pendingPrompts: string[] = []
  private requestSeq = 0
  private sessionId: string | null = null
  private summaryWaiters = new Map<string, (summary: SessionSummary) => void>()
  private sessionListWaiters = new Map<string, (sessions: SessionListItem[]) => void>()
  private sessionListAllWaiters = new Map<string, (sessions: SessionListItem[]) => void>()
  private sessionMetaWaiters = new Map<string, (meta: SessionMeta) => void>()
  private modelListWaiters = new Map<
    string,
    (result: { models: ModelListItem[]; current: { providerId: string; modelId: string } }) => void
  >()
  private providerTemplateWaiters = new Map<string, (templates: ProviderTemplate[]) => void>()
  /** agent 进程报告的 agentDir（用于写 models.json） */
  private agentDir: string | null = null
  private historyWaiters = new Map<string, (messages: SessionHistoryMessage[]) => void>()
  private settingsWaiters = new Map<string, (snapshot: SettingsSnapshot) => void>()
  private writeWaiters = new Map<string, (result: SettingsWriteResult) => void>()
  private reloadWaiters = new Map<string, (result: SettingsReloadResult) => void>()
  private packageWaiters = new Map<string, (result: PackageResult) => void>()
  private mcpWaiters = new Map<string, (result: McpConfigResult) => void>()
  private resourcesWaiters = new Map<string, (snapshot: ResourcesSnapshot) => void>()
  private trustWaiters = new Map<string, (snapshot: TrustSnapshot) => void>()
  private trustWriteWaiters = new Map<string, (result: TrustWriteResult) => void>()
  private treeWaiters = new Map<string, (r: { tree: TreeEntry[]; leafId: string | null }) => void>()
  /** agent 侧审批 requestId → UI callId 映射 */
  private approvalByCallId = new Map<string, string>()
  /** agent 就绪等待者（启动/重启后需要等进程起来再操作） */
  private readyWaiters: Array<() => void> = []

  /** 等待 agent 进程就绪；已就绪时立即返回 */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve()
    return new Promise((resolve) => this.readyWaiters.push(resolve))
  }

  private flushReadyWaiters(): void {
    const waiters = this.readyWaiters
    this.readyWaiters = []
    for (const resolve of waiters) resolve()
  }

  /** 启动 Agent Utility Process（构建产物为 out/main/agent.js） */
  start(workspace: string, providerKeys: Record<string, string> = {}): void {
    const child = utilityProcess.fork(join(__dirname, 'agent.js'), [], {
      serviceName: 'piforge-agent',
      env: {
        ...process.env,
        PIFORGE_WORKSPACE: workspace,
        // 自定义 provider 的运行时密钥：进程环境传递，不落盘
        PIFORGE_PROVIDER_KEYS: JSON.stringify(providerKeys),
        // API Key：优先 safeStorage 加密存储，其次环境变量
        DEEPSEEK_API_KEY: resolveApiKey() ?? ''
      }
    })
    this.child = child

    child.on('message', (message) => this.handle(message as AgentOutbound))
    child.on('exit', (code) => {
      // restart 会先 kill 旧进程再启动新进程，旧进程的 exit 是迟到的：
      // 只有当前子进程才处理，否则会把新进程引用清空
      if (this.child !== child) return
      this.ready = false
      this.child = null
      // 进程退出时释放等待者，避免调用方永久挂起（后续调用会拿到空结果）
      this.flushReadyWaiters()
      this.broadcast({ type: 'error', message: `Agent 进程退出（code=${code}）` })
    })
  }

  /** 发送 prompt（未就绪时排队） */
  prompt(text: string): void {
    if (!this.ready || !this.child) {
      this.pendingPrompts.push(text)
      return
    }
    // 开始一次 trace（本地可观测性）
    try {
      beginTrace(this.sessionId ?? 'current', 'deepseek-flash', text)
    } catch {
      // trace 失败不影响对话
    }
    this.child.postMessage({ type: 'prompt', text })
  }

  /** 读取会话摘要 */
  getSummary(): Promise<SessionSummary> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve({
          sessionId: 'disconnected',
          model: 'unknown',
          messageCount: 0,
          tokenUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          cost: 0
        })
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.summaryWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'summary', requestId })
    })
  }

  /** 列出历史会话（当前工作区） */
  listSessions(): Promise<SessionListItem[]> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve([])
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.sessionListWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'session_list', requestId })
    })
  }

  /** 跨项目列出全部历史会话（每条带 cwd，供渲染层按项目分组） */
  listAllSessions(): Promise<SessionListItem[]> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve([])
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.sessionListAllWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'session_list_all', requestId })
    })
  }

  /** 当前会话的模型 / 思考档位 / 上下文用量 */
  getSessionMeta(): Promise<SessionMeta | null> {
    return this.request({ type: 'session_meta' }, this.sessionMetaWaiters)
  }

  /** 可用模型清单 + 当前选择 */
  listModels(): Promise<{
    models: ModelListItem[]
    current: { providerId: string; modelId: string }
  } | null> {
    return this.request({ type: 'model_list' }, this.modelListWaiters)
  }

  /** 设置思考档位（下一轮或立即可见） */
  setThinkingLevel(level: string): void {
    this.child?.postMessage({ type: 'session_set_thinking', level })
  }

  /** 切换当前会话模型 */
  setModel(providerId: string, modelId: string): void {
    this.child?.postMessage({ type: 'session_set_model', providerId, modelId })
  }

  /** 设置审批模式：auto 完全自动放行，ask 危险操作弹窗 */
  setApprovalMode(mode: ApprovalMode): void {
    this.child?.postMessage({ type: 'approval_mode', mode })
  }

  /**
   * 向 agent 进程发一个带 requestId 的读取请求并等待回包。
   * agent 未就绪时返回 null（而不是伪造空数据），由 UI 自行展示未就绪状态。
   */
  private request<T>(
    payload: Record<string, unknown>,
    waiters: Map<string, (value: T) => void>
  ): Promise<T | null> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve(null)
        return
      }
      const requestId = `req-${++this.requestSeq}`
      waiters.set(requestId, resolve)
      this.child.postMessage({ ...payload, requestId })
    })
  }

  /** 读取设置只读快照（设置中心） */
  readSettings(): Promise<SettingsSnapshot | null> {
    return this.request({ type: 'settings_read' }, this.settingsWaiters)
  }

  /** 写入设置。scope 校验、值校验、备份与原子写入均在 agent 侧完成 */
  writeSettings(request: SettingsWriteRequest): Promise<SettingsWriteResult | null> {
    return this.request(
      { type: 'settings_write', scope: request.scope, entries: request.entries },
      this.writeWaiters
    )
  }

  /** 重载 agent：重读设置 + 重载资源 + 重建工具集 */
  reloadAgent(): Promise<SettingsReloadResult | null> {
    return this.request({ type: 'settings_reload' }, this.reloadWaiters)
  }

  listPackages(): Promise<PackageResult | null> {
    return this.request({ type: 'packages_list' }, this.packageWaiters)
  }

  installPackage(request: PackageActionRequest): Promise<PackageResult | null> {
    return this.request(
      { type: 'packages_install', source: request.source, local: request.local },
      this.packageWaiters
    )
  }

  removePackage(request: PackageActionRequest): Promise<PackageResult | null> {
    return this.request(
      { type: 'packages_remove', source: request.source, local: request.local },
      this.packageWaiters
    )
  }

  updatePackages(request: { source?: string }): Promise<PackageResult | null> {
    return this.request(
      { type: 'packages_update', source: request.source },
      this.packageWaiters
    )
  }

  readMcpConfig(): Promise<McpConfigResult | null> {
    return this.request({ type: 'mcp_list' }, this.mcpWaiters)
  }

  upsertMcpServer(request: McpUpsertRequest): Promise<McpConfigResult | null> {
    return this.request({ type: 'mcp_upsert', request }, this.mcpWaiters)
  }

  removeMcpServer(request: McpScopeNameRequest): Promise<McpConfigResult | null> {
    return this.request({ type: 'mcp_remove', request }, this.mcpWaiters)
  }

  patchMcpServer(request: McpPatchRequest): Promise<McpConfigResult | null> {
    return this.request({ type: 'mcp_patch', request }, this.mcpWaiters)
  }

  /** 读取已加载资源快照（扩展 / skill / 上下文文件） */
  readResources(): Promise<ResourcesSnapshot | null> {
    return this.request({ type: 'resources_read' }, this.resourcesWaiters)
  }

  /** 读取项目信任快照 */
  readTrust(): Promise<TrustSnapshot | null> {
    return this.request({ type: 'trust_read' }, this.trustWaiters)
  }

  /** 写入 / 清除项目信任决定 */
  writeTrust(request: TrustWriteRequest): Promise<TrustWriteResult | null> {
    return this.request(
      { type: 'trust_set', decision: request.decision },
      this.trustWriteWaiters
    )
  }

  /** 读取当前会话活动分支的历史消息（切换/恢复会话后回显） */
  getSessionMessages(): Promise<SessionHistoryMessage[]> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve([])
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.historyWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'session_messages', requestId })
    })
  }

  /** 读取会话树 */
  getTree(): Promise<{ tree: TreeEntry[]; leafId: string | null }> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve({ tree: [], leafId: null })
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.treeWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'tree_get', requestId })
    })
  }

  /** 导航到会话树节点 */
  navigateTree(
    targetId: string,
    options: { summarize?: boolean; customInstructions?: string; label?: string }
  ): Promise<{ tree: TreeEntry[]; leafId: string | null }> {
    return new Promise((resolve) => {
      if (!this.child) {
        resolve({ tree: [], leafId: null })
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.treeWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'tree_navigate', targetId, options })
    })
  }

  /** 新建会话 */
  newSession(): void {
    this.child?.postMessage({ type: 'session_new' })
  }

  /** 切换到指定会话 */
  switchSession(sessionPath: string): void {
    this.child?.postMessage({ type: 'session_switch', sessionPath })
  }

  /** 回传审批结果（renderer → 主进程 → agent） */
  respondApproval(callId: string, approved: boolean): void {
    const requestId = this.approvalByCallId.get(callId)
    if (!requestId) return
    this.approvalByCallId.delete(callId)
    this.child?.postMessage({ type: 'approval_response', requestId, approved })
  }

  dispose(): void {
    this.child?.postMessage({ type: 'dispose' })
    this.child?.kill()
    this.child = null
    this.ready = false
  }

  /** 重启 Agent 进程（例如 API Key 更新后） */
  restart(workspace: string, providerKeys: Record<string, string> = {}): void {
    this.dispose()
    this.start(workspace, providerKeys)
  }

  /** agent 进程所在目录（未就绪时 null） */
  getAgentDir(): string | null {
    return this.agentDir
  }

  /** 供应商类型模板（来自 SDK 内置目录） */
  getProviderTemplates(): Promise<ProviderTemplate[] | null> {
    return this.request({ type: 'provider_templates' }, this.providerTemplateWaiters)
  }

  private handle(message: AgentOutbound): void {
    switch (message.type) {
      case 'ready': {
        this.ready = true
        if (typeof message.agentDir === 'string' && message.agentDir) this.agentDir = message.agentDir
        this.flushReadyWaiters()
        const queued = this.pendingPrompts
        this.pendingPrompts = []
        for (const text of queued) this.prompt(text)
        break
      }
      case 'event': {
        // 本地可观测性：记录工具 span 与 trace 结束
        try {
          if (message.event.type === 'tool_call_end') {
            recordToolSpan(
              message.event.callId,
              'tool',
              undefined,
              message.event.result,
              message.event.ok,
              message.event.error
            )
          } else if (message.event.type === 'turn_end') {
            endTrace('ok')
          } else if (message.event.type === 'error') {
            endTrace('error')
          }
        } catch {
          // trace 失败不影响对话
        }
        this.broadcast(message.event)
        break
      }
      case 'summary': {
        this.sessionId = message.summary.sessionId
        const waiter = this.summaryWaiters.get(message.requestId)
        if (waiter) {
          this.summaryWaiters.delete(message.requestId)
          waiter(message.summary)
        }
        break
      }
      case 'approval_request': {
        // 记住 requestId，等 UI 回传时用 callId 反查
        this.approvalByCallId.set(message.request.callId, message.requestId)
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.APPROVAL_REQUEST, message.request)
        }
        break
      }
      case 'tree_result': {
        // navigate 的 requestId 固定为 'navigate'，广播给所有等待者
        const waiters = [...this.treeWaiters.values()]
        this.treeWaiters.clear()
        for (const w of waiters) w({ tree: message.tree, leafId: message.leafId })
        if (waiters.length === 0) {
          this.broadcast({ type: 'turn_end' })
        }
        break
      }
      case 'session_list_result': {
        const waiter = this.sessionListWaiters.get(message.requestId)
        if (waiter) {
          this.sessionListWaiters.delete(message.requestId)
          waiter(message.sessions)
        }
        break
      }
      case 'session_list_all_result': {
        const waiter = this.sessionListAllWaiters.get(message.requestId)
        if (waiter) {
          this.sessionListAllWaiters.delete(message.requestId)
          waiter(message.sessions)
        }
        break
      }
      case 'session_meta_result': {
        const waiter = this.sessionMetaWaiters.get(message.requestId)
        if (waiter) {
          this.sessionMetaWaiters.delete(message.requestId)
          waiter(message.meta)
        }
        break
      }
      case 'model_list_result': {
        const waiter = this.modelListWaiters.get(message.requestId)
        if (waiter) {
          this.modelListWaiters.delete(message.requestId)
          waiter({ models: message.models, current: message.current })
        }
        break
      }
      case 'provider_templates_result': {
        const waiter = this.providerTemplateWaiters.get(message.requestId)
        if (waiter) {
          this.providerTemplateWaiters.delete(message.requestId)
          waiter(message.templates)
        }
        break
      }
      case 'session_messages_result': {
        const waiter = this.historyWaiters.get(message.requestId)
        if (waiter) {
          this.historyWaiters.delete(message.requestId)
          waiter(message.messages)
        }
        break
      }
      case 'settings_snapshot': {
        const waiter = this.settingsWaiters.get(message.requestId)
        if (waiter) {
          this.settingsWaiters.delete(message.requestId)
          waiter(message.snapshot)
        }
        break
      }
      case 'settings_write_result': {
        const waiter = this.writeWaiters.get(message.requestId)
        if (waiter) {
          this.writeWaiters.delete(message.requestId)
          waiter(message.result)
        }
        break
      }
      case 'settings_reload_result': {
        const waiter = this.reloadWaiters.get(message.requestId)
        if (waiter) {
          this.reloadWaiters.delete(message.requestId)
          waiter(message.result)
        }
        break
      }
      case 'resources_snapshot': {
        const waiter = this.resourcesWaiters.get(message.requestId)
        if (waiter) {
          this.resourcesWaiters.delete(message.requestId)
          waiter(message.snapshot)
        }
        break
      }
      case 'trust_snapshot': {
        const waiter = this.trustWaiters.get(message.requestId)
        if (waiter) {
          this.trustWaiters.delete(message.requestId)
          waiter(message.snapshot)
        }
        break
      }
      case 'trust_write_result': {
        const waiter = this.trustWriteWaiters.get(message.requestId)
        if (waiter) {
          this.trustWriteWaiters.delete(message.requestId)
          waiter(message.result)
        }
        break
      }
      case 'packages_result': {
        const waiter = this.packageWaiters.get(message.requestId)
        if (waiter) {
          this.packageWaiters.delete(message.requestId)
          waiter(message.result)
        }
        break
      }
      case 'packages_progress': {
        // 安装 / 更新可能耗时较久，进度直接广播给所有窗口
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.PACKAGES_PROGRESS, message.progress)
        }
        break
      }
      case 'mcp_config_result': {
        const waiter = this.mcpWaiters.get(message.requestId)
        if (waiter) {
          this.mcpWaiters.delete(message.requestId)
          waiter(message.result)
        }
        break
      }
      case 'mcp_open_url': {
        // MCP 的 OAuth 登录在 agent 进程里发起，由主进程用系统浏览器打开
        if (message.url.startsWith('https://') || message.url.startsWith('http://')) {
          void shell.openExternal(message.url)
        }
        break
      }
      case 'error':
        this.broadcast({ type: 'error', message: message.message })
        break
    }
  }

  /** 把事件广播给所有窗口 */
  private broadcast(event: AgentEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.AGENT_EVENT, event)
    }
  }
}

export const agentHost = new AgentHost()
