import { createSession, listSessions, type SessionHandle } from './session'
import type { ApprovalRequest } from './approval'
import type { AgentEvent } from '../shared/agent-events'
import type { SessionSummary, SessionListItem } from '../shared/ipc-types'

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
  | { type: 'dispose' }

type OutboundMessage =
  | { type: 'ready' }
  | { type: 'event'; event: AgentEvent }
  | { type: 'summary'; requestId: string; summary: SessionSummary }
  | { type: 'approval_request'; requestId: string; request: ApprovalRequest }
  | { type: 'session_list_result'; requestId: string; sessions: SessionListItem[] }
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

port.on('message', (event) => {
  void handle(event.data as InboundMessage)
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
