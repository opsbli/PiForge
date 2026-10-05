import { createSession, type SessionHandle } from './session'
import type { ApprovalRequest } from './approval'
import type { AgentEvent } from '../shared/agent-events'
import type { SessionSummary } from '../shared/ipc-types'

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
  | { type: 'dispose' }

type OutboundMessage =
  | { type: 'ready' }
  | { type: 'event'; event: AgentEvent }
  | { type: 'summary'; requestId: string; summary: SessionSummary }
  | { type: 'approval_request'; requestId: string; request: ApprovalRequest }
  | { type: 'error'; message: string }

const port = process.parentPort

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

  if (message.type === 'dispose') {
    session?.dispose()
    session = null
  }
}

async function main(): Promise<void> {
  const cwd = process.env.PIFORGE_WORKSPACE ?? process.cwd()
  session = await createSession(cwd, approvalBridge)
  session.onEvent((event) => post({ type: 'event', event }))
  post({ type: 'ready' })
}

main().catch((err) => {
  post({ type: 'error', message: `Agent 启动失败：${String(err)}` })
})
