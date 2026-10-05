import { createSession, listAllSessions, listSessions, type SessionHandle, type TreeEntry } from './session'
import type { ApprovalRequest } from './approval'
import {
  buildSettingsSnapshot,
  emptySettingsSnapshot,
  settingsPaths
} from './settings-service'
import { applySettingsWrite } from './settings-write'
import {
  patchMcpServer,
  readMcpConfig,
  removeMcpServer,
  upsertMcpServer
} from './mcp-config'
import { emptyResourcesSnapshot } from './resources-service'
import { listPackages, toPackageProgress } from './packages-service'
import { buildTrustSnapshot, emptyTrustSnapshot } from './trust-service'
import type { PackageManager, ProjectTrustStore, SettingsManager } from '@earendil-works/pi-coding-agent'
import type { AgentEvent } from '../shared/agent-events'
import type {
  McpConfigResult,
  McpConfigView,
  McpPatchRequest,
  McpScopeNameRequest,
  McpUpsertRequest,
  PackageInfo,
  PackageProgress,
  PackageResult,
  ResourcesSnapshot,
  SessionSummary,
  SessionListItem,
  SessionHistoryMessage,
  SettingsPatchEntry,
  SettingsReloadResult,
  SettingsScopeName,
  SettingsSnapshot,
  SettingsWriteResult,
  TrustSnapshot,
  TrustWriteResult
} from '../shared/ipc-types'

/**
 * Agent Utility Process 入口。
 *
 * 运行 pi-agent SDK，管理 AgentSession 与工具执行；通过 parentPort 与主进程通信。
 * 主进程不直接执行 Agent 逻辑，只做转发。
 */

type InboundMessage =
  | { type: 'prompt'; text: string }
  | { type: 'summary'; requestId: string }
  | { type: 'approval_response'; requestId: string; approved: boolean }
  | { type: 'session_list'; requestId: string }
  | { type: 'session_list_all'; requestId: string }
  | { type: 'session_new' }
  | { type: 'session_switch'; sessionPath: string }
  | { type: 'session_messages'; requestId: string }
  | { type: 'settings_read'; requestId: string }
  | {
      type: 'settings_write'
      requestId: string
      scope: SettingsScopeName
      entries: SettingsPatchEntry[]
    }
  | { type: 'settings_reload'; requestId: string }
  | { type: 'packages_list'; requestId: string }
  | { type: 'packages_install'; requestId: string; source: string; local: boolean }
  | { type: 'packages_remove'; requestId: string; source: string; local: boolean }
  | { type: 'packages_update'; requestId: string; source?: string }
  | { type: 'mcp_list'; requestId: string }
  | { type: 'mcp_upsert'; requestId: string; request: McpUpsertRequest }
  | { type: 'mcp_remove'; requestId: string; request: McpScopeNameRequest }
  | { type: 'mcp_patch'; requestId: string; request: McpPatchRequest }
  | { type: 'resources_read'; requestId: string }
  | { type: 'trust_read'; requestId: string }
  | { type: 'trust_set'; requestId: string; decision: boolean | null }
  | { type: 'tree_get'; requestId: string }
  | {
      type: 'tree_navigate'
      targetId: string
      options: { summarize?: boolean; customInstructions?: string; label?: string }
    }
  | { type: 'dispose' }

type OutboundMessage =
  | { type: 'ready' }
  | { type: 'event'; event: AgentEvent }
  | { type: 'summary'; requestId: string; summary: SessionSummary }
  | { type: 'approval_request'; requestId: string; request: ApprovalRequest }
  | { type: 'session_list_result'; requestId: string; sessions: SessionListItem[] }
  | { type: 'session_list_all_result'; requestId: string; sessions: SessionListItem[] }
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

const port = process.parentPort
const workspace = process.env.PIFORGE_WORKSPACE ?? process.cwd()

let session: SessionHandle | null = null
/**
 * 跨会话共享的 SDK 对象。
 * SettingsManager 必须只有一个实例：设置中心写入后，运行中的会话要能立即读到新值
 * （AgentSession 持有的是同一个引用）。
 */
let settingsManager: SettingsManager | null = null
let trustStore: ProjectTrustStore | null = null
let packageManager: PackageManager | null = null
let sdkRequiresTrust: ((cwd: string) => boolean) | null = null
let sdkVersion: string | null = null
let agentDir = ''
const pendingApprovals = new Map<string, (approved: boolean) => void>()
let approvalSeq = 0

function post(message: OutboundMessage): void {
  port.postMessage(message)
}

/** 审批桥：把请求送到主进程/UI，异步等待用户决定 */
const approvalBridge = {
  request(request: ApprovalRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const requestId = `appr-${++approvalSeq}`
      pendingApprovals.set(requestId, resolve)
      post({ type: 'approval_request', requestId, request })
    })
  }
}

/**
 * 会话级操作串行链。
 *
 * session_new / session_switch 是异步重建会话，重建期间 `session` 仍指向旧句柄；
 * 若此时插入读取请求（如 session_messages），会拿到上一个会话的数据。
 * 因此把「读写当前会话」的请求排进同一条链。
 *
 * prompt 与 approval_response 必须立即派发：prompt 会 await 整个 turn，
 * 审批响应排在其后会直接死锁。
 */
let sessionOps: Promise<void> = Promise.resolve()

/**
 * 共享对象（SettingsManager / PackageManager）的初始化 Promise。
 * 重启后消息可能先于 bootstrap 完成到达，因此各类会话请求要先等它落定。
 */
let bootstrapPromise: Promise<void> = Promise.resolve()

function runSessionOp(task: () => Promise<void>): void {
  sessionOps = sessionOps
    .then(async () => {
      await bootstrapPromise
      await task()
    })
    .catch((err) => {
      post({ type: 'error', message: `会话操作失败：${String(err)}` })
    })
}

const IMMEDIATE_TYPES: ReadonlySet<InboundMessage['type']> = new Set([
  'prompt',
  'approval_response'
])

port.on('message', (event) => {
  const message = event.data as InboundMessage
  if (IMMEDIATE_TYPES.has(message.type)) {
    void handle(message)
    return
  }
  runSessionOp(() => handle(message))
})

/** 加载 SDK 并初始化共享对象（SDK 是纯 ESM，本进程为 CJS，只能动态 import） */
async function bootstrap(): Promise<void> {
  const sdk = await import('@earendil-works/pi-coding-agent')
  agentDir = sdk.getAgentDir()
  settingsManager = sdk.SettingsManager.create(workspace, agentDir)
  trustStore = new sdk.ProjectTrustStore(agentDir)
  sdkRequiresTrust = sdk.hasTrustRequiringProjectResources
  sdkVersion = sdk.VERSION ?? null

  // 不传 builtinExtensions：PiForge 不加载内置扩展，声明它们会造成误解
  packageManager = new sdk.DefaultPackageManager({ cwd: workspace, agentDir, settingsManager })
  packageManager.setProgressCallback((event) => {
    post({ type: 'packages_progress', progress: toPackageProgress(event) })
  })
}

/** 建立会话并挂上事件流 */
async function openSession(resumePath?: string): Promise<void> {
  if (!settingsManager) throw new Error('设置管理器尚未就绪')
  session?.dispose()
  session = await createSession({
    cwd: workspace,
    bridge: approvalBridge,
    settingsManager,
    resumePath,
    // MCP 的 OAuth 登录由扩展触发；这里把 URL 转给主进程用系统浏览器打开
    openUrl: (url) => post({ type: 'mcp_open_url', url })
  })
  session.onEvent((event) => post({ type: 'event', event }))
}

/** 当前的信任快照；settingsManager / trustStore 未就绪时返回空快照 */
function currentTrustSnapshot(): TrustSnapshot {
  if (!settingsManager || !trustStore) return emptyTrustSnapshot(workspace)
  return buildTrustSnapshot({
    cwd: workspace,
    sdkRequiresTrust: sdkRequiresTrust ? sdkRequiresTrust(workspace) : false,
    decision: trustStore.get(workspace),
    savedPath: settingsPaths(workspace, agentDir).trustFile,
    loaderTrusted: settingsManager.isProjectTrusted(),
    defaultProjectTrust: settingsManager.getDefaultProjectTrust()
  })
}

function currentSettingsSnapshot(): SettingsSnapshot | null {
  return settingsManager
    ? buildSettingsSnapshot(settingsManager, workspace, agentDir, { sdk: sdkVersion })
    : null
}

function failedWrite(error: string): SettingsWriteResult {
  return { ok: false, error, appliedLive: [], needsReload: [], settings: null, resources: null }
}

function safePackageList(): PackageInfo[] {
  try {
    return packageManager ? listPackages(packageManager) : []
  } catch {
    // 列表失败不应连带把整个动作判为失败
    return []
  }
}

function packageResult(): PackageResult {
  return { ok: true, packages: safePackageList() }
}

function failedPackages(error: string): PackageResult {
  return { ok: false, error, packages: safePackageList() }
}

/** MCP 配置读写的共同上下文 */
function mcpContext(): { cwd: string; agentDir: string; projectTrusted: boolean } {
  return {
    cwd: workspace,
    agentDir,
    projectTrusted: settingsManager ? settingsManager.isProjectTrusted() : false
  }
}

function mcpConfigResult(error?: string): McpConfigResult {
  return { ok: !error, error, config: readMcpConfig(mcpContext()) }
}

async function handle(message: InboundMessage): Promise<void> {
  if (message.type === 'prompt') {
    if (!session) {
      post({ type: 'error', message: '会话未就绪' })
      return
    }
    try {
      await session.send(message.text)
    } catch (err) {
      post({ type: 'error', message: `prompt 失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'summary') {
    if (!session) {
      post({ type: 'error', message: '会话未就绪' })
      return
    }
    post({ type: 'summary', requestId: message.requestId, summary: session.summary() })
    return
  }

  if (message.type === 'approval_response') {
    const resolve = pendingApprovals.get(message.requestId)
    if (resolve) {
      pendingApprovals.delete(message.requestId)
      resolve(message.approved)
    }
    return
  }

  if (message.type === 'session_list') {
    try {
      const sessions = await listSessions(workspace)
      post({ type: 'session_list_result', requestId: message.requestId, sessions })
    } catch (err) {
      post({ type: 'error', message: `列出会话失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'session_list_all') {
    try {
      const sessions = await listAllSessions()
      post({ type: 'session_list_all_result', requestId: message.requestId, sessions })
    } catch (err) {
      post({ type: 'error', message: `列出全部会话失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'session_new') {
    try {
      await openSession()
    } catch (err) {
      post({ type: 'error', message: `新建会话失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'session_switch') {
    try {
      await openSession(message.sessionPath)
    } catch (err) {
      post({ type: 'error', message: `切换会话失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'session_messages') {
    // 会话未就绪时返回空列表（而非报错），让 UI 得到确定结果
    post({
      type: 'session_messages_result',
      requestId: message.requestId,
      messages: session ? session.history() : []
    })
    return
  }

  if (message.type === 'settings_read') {
    post({
      type: 'settings_snapshot',
      requestId: message.requestId,
      snapshot: settingsManager
        ? buildSettingsSnapshot(settingsManager, workspace, agentDir, { sdk: sdkVersion })
        : emptySettingsSnapshot(workspace, agentDir)
    })
    return
  }

  if (message.type === 'resources_read') {
    post({
      type: 'resources_snapshot',
      requestId: message.requestId,
      snapshot: session ? session.resources() : emptyResourcesSnapshot()
    })
    return
  }

  if (message.type === 'trust_read') {
    post({
      type: 'trust_snapshot',
      requestId: message.requestId,
      snapshot: currentTrustSnapshot()
    })
    return
  }

  if (message.type === 'settings_write') {
    if (!settingsManager) {
      post({
        type: 'settings_write_result',
        requestId: message.requestId,
        result: failedWrite('设置管理器尚未就绪')
      })
      return
    }

    // 项目级配置会进入版本控制并影响他人，未信任时直接拒绝
    if (message.scope === 'project' && !settingsManager.isProjectTrusted()) {
      post({
        type: 'settings_write_result',
        requestId: message.requestId,
        result: failedWrite('项目未被信任，已拒绝写入项目级配置')
      })
      return
    }

    const paths = settingsPaths(workspace, agentDir)
    const outcome = applySettingsWrite({
      scope: message.scope,
      entries: message.entries,
      filePath: message.scope === 'global' ? paths.globalSettings : paths.projectSettings
    })

    if (!outcome.ok) {
      post({
        type: 'settings_write_result',
        requestId: message.requestId,
        result: failedWrite(outcome.error ?? '写入失败')
      })
      return
    }

    // 让共享的实例重新读盘，运行中的会话才能看到新值
    await settingsManager.reload()

    const appliedLive = session ? session.applyLiveSettings(outcome.changes) : []
    // 未能立即生效的字段都需要重载（包含规格标注可 live、但实际应用失败的）
    const needsReload = outcome.changed.filter((key) => !appliedLive.includes(key))

    post({
      type: 'settings_write_result',
      requestId: message.requestId,
      result: {
        ok: true,
        target: outcome.target,
        appliedLive,
        needsReload,
        settings: currentSettingsSnapshot(),
        resources: session ? session.resources() : emptyResourcesSnapshot()
      }
    })
    return
  }

  if (message.type === 'settings_reload') {
    if (!session || !settingsManager) {
      post({
        type: 'settings_reload_result',
        requestId: message.requestId,
        result: { ok: false, error: 'agent 尚未就绪', settings: null, resources: null }
      })
      return
    }

    try {
      await settingsManager.reload()
      await session.reload()
      post({
        type: 'settings_reload_result',
        requestId: message.requestId,
        result: {
          ok: true,
          settings: currentSettingsSnapshot(),
          resources: session.resources()
        }
      })
    } catch (error) {
      post({
        type: 'settings_reload_result',
        requestId: message.requestId,
        result: {
          ok: false,
          error: `重载失败：${String(error)}。若持续失败，请重启 agent（在设置里切换一次 API Key 即可）。`,
          settings: currentSettingsSnapshot(),
          resources: null
        }
      })
    }
    return
  }

  if (message.type === 'packages_list') {
    post({ type: 'packages_result', requestId: message.requestId, result: packageResult() })
    return
  }

  if (message.type === 'packages_install' || message.type === 'packages_remove') {
    if (!packageManager) {
      post({
        type: 'packages_result',
        requestId: message.requestId,
        result: failedPackages('包管理器尚未就绪')
      })
      return
    }

    const source = message.source.trim()
    if (!source) {
      post({
        type: 'packages_result',
        requestId: message.requestId,
        result: failedPackages('来源不能为空')
      })
      return
    }

    try {
      if (message.type === 'packages_install') {
        await packageManager.installAndPersist(source, { local: message.local })
      } else {
        await packageManager.removeAndPersist(source, { local: message.local })
      }
      // 动作会改动配置，重新读盘让快照与运行中的会话看到新值
      await settingsManager?.reload()
      post({ type: 'packages_result', requestId: message.requestId, result: packageResult() })
    } catch (error) {
      post({
        type: 'packages_result',
        requestId: message.requestId,
        result: failedPackages(
          `操作失败：${String(error)}。请确认来源可访问、网络可用，或先在终端里手动执行。`
        )
      })
    }
    return
  }

  if (message.type === 'packages_update') {
    if (!packageManager) {
      post({
        type: 'packages_result',
        requestId: message.requestId,
        result: failedPackages('包管理器尚未就绪')
      })
      return
    }

    try {
      await packageManager.update(message.source)
      await settingsManager?.reload()
      post({ type: 'packages_result', requestId: message.requestId, result: packageResult() })
    } catch (error) {
      post({
        type: 'packages_result',
        requestId: message.requestId,
        result: failedPackages(`更新失败：${String(error)}`)
      })
    }
    return
  }

  if (message.type === 'mcp_list') {
    post({
      type: 'mcp_config_result',
      requestId: message.requestId,
      result: mcpConfigResult()
    })
    return
  }

  if (message.type === 'mcp_upsert') {
    const result = upsertMcpServer(message.request, mcpContext())
    // 服务器增删改后需要重载才会真正连接，因此只回报结果，不在这里重建会话
    post({ type: 'mcp_config_result', requestId: message.requestId, result })
    return
  }

  if (message.type === 'mcp_remove') {
    post({
      type: 'mcp_config_result',
      requestId: message.requestId,
      result: removeMcpServer(message.request, mcpContext())
    })
    return
  }

  if (message.type === 'mcp_patch') {
    post({
      type: 'mcp_config_result',
      requestId: message.requestId,
      result: patchMcpServer(message.request, mcpContext())
    })
    return
  }

  if (message.type === 'trust_set') {
    if (!trustStore || !settingsManager) {
      post({
        type: 'trust_write_result',
        requestId: message.requestId,
        result: { ok: false, error: 'agent 尚未就绪', trust: null }
      })
      return
    }

    try {
      // 1) 落盘信任决定（null 表示清除）
      trustStore.set(workspace, message.decision === null ? null : message.decision === true)
      // 2) 让运行中的会话按新决定生效：resourceLoader 的 resolveProjectTrust 只受询一次，
      //    因此必须显式改 SettingsManager 的信任标志并重载，否则改了也不生效。
      settingsManager.setProjectTrusted(message.decision === true)
      await settingsManager.reload()
      await session?.reload()

      const note =
        message.decision === null
          ? '已清除保存的决定。当前会话按「未信任」重载，下次启动将按 defaultProjectTrust 决定。'
          : message.decision
            ? '已信任该项目。项目级配置与资源已在本会话加载。'
            : '已拒绝该项目。项目级配置与资源已在本会话停用。'

      post({
        type: 'trust_write_result',
        requestId: message.requestId,
        result: { ok: true, trust: currentTrustSnapshot(), note }
      })
    } catch (error) {
      post({
        type: 'trust_write_result',
        requestId: message.requestId,
        result: {
          ok: false,
          error: `写入信任决定失败：${String(error)}`,
          trust: currentTrustSnapshot()
        }
      })
    }
    return
  }

  if (message.type === 'tree_get') {
    if (!session) {
      post({ type: 'error', message: '会话未就绪' })
      return
    }
    post({
      type: 'tree_result',
      requestId: message.requestId,
      tree: session.getTree(),
      leafId: session.getLeafId()
    })
    return
  }

  if (message.type === 'tree_navigate') {
    if (!session) {
      post({ type: 'error', message: '会话未就绪' })
      return
    }
    try {
      const result = await session.navigate(message.targetId, message.options ?? {})
      if (result.cancelled) {
        post({ type: 'error', message: '导航被取消' })
      } else {
        post({
          type: 'tree_result',
          requestId: 'navigate',
          tree: session.getTree(),
          leafId: session.getLeafId()
        })
      }
    } catch (err) {
      post({ type: 'error', message: `导航失败：${String(err)}` })
    }
    return
  }

  if (message.type === 'dispose') {
    session?.dispose()
    session = null
  }
}

async function main(): Promise<void> {
  bootstrapPromise = bootstrap()
  await bootstrapPromise
  // 初始会话排进同一条串行链，避免与并发的 session_new / session_switch 交叉
  const initial = sessionOps
    .then(() => openSession())
    .catch((err) => {
      post({ type: 'error', message: `初始化会话失败：${String(err)}` })
    })
  sessionOps = initial
  await initial
  post({ type: 'ready' })
}

main().catch((err) => {
  post({ type: 'error', message: `Agent 启动失败：${String(err)}` })
})
