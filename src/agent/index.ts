import { createSession, listSessions, type SessionHandle, type TreeEntry } from './session'
import type { ApprovalRequest } from './approval'
import type { AgentEvent } from '../shared/agent-events'
import type { SessionSummary, SessionListItem, SessionHistoryMessage } from '../shared/ipc-types'

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
  | { type: 'session_new' }
  | { type: 'session_switch'; sessionPath: string }
  | { type: 'session_messages'; requestId: string }
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
  | { type: 'session_messages_result'; requestId: string; messages: SessionHistoryMessage[] }
  | { type: 'tree_result'; requestId: string; tree: TreeEntry[]; leafId: string | null }
  | { type: 'error'; message: string }

const port = process.parentPort
const workspace = process.env.PIFORGE_WORKSPACE ?? process.cwd()

let session: SessionHandle | null = null
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

function runSessionOp(task: () => Promise<void>): void {
  sessionOps = sessionOps.then(task).catch((err) => {
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

/** 建立会话并挂上事件流 */
async function openSession(resumePath?: string): Promise<void> {
  session?.dispose()
  session = await createSession({ cwd: workspace, bridge: approvalBridge, resumePath })
  session.onEvent((event) => post({ type: 'event', event }))
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
  await openSession()
  post({ type: 'ready' })
}

main().catch((err) => {
  post({ type: 'error', message: `Agent 启动失败：${String(err)}` })
})
