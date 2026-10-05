import { utilityProcess, type UtilityProcess, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc-types'
import type { SessionSummary, ApprovalRequest } from '../shared/ipc-types'
import type { AgentEvent } from '../shared/agent-events'
import { resolveApiKey } from './credentials'

type AgentOutbound =
  | { type: 'ready' }
  | { type: 'event'; event: AgentEvent }
  | { type: 'summary'; requestId: string; summary: SessionSummary }
  | { type: 'approval_request'; requestId: string; request: ApprovalRequest }
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
  private summaryWaiters = new Map<string, (summary: SessionSummary) => void>()
  /** agent 侧审批 requestId → UI callId 映射 */
  private approvalByCallId = new Map<string, string>()

  /** 启动 Agent Utility Process（构建产物为 out/main/agent.js） */
  start(workspace: string): void {
    const child = utilityProcess.fork(join(__dirname, 'agent.js'), [], {
      serviceName: 'piforge-agent',
      env: {
        ...process.env,
        PIFORGE_WORKSPACE: workspace,
        // API Key：优先 safeStorage 加密存储，其次环境变量
        DEEPSEEK_API_KEY: resolveApiKey() ?? ''
      }
    })
    this.child = child

    child.on('message', (message) => this.handle(message as AgentOutbound))
    child.on('exit', (code) => {
      this.ready = false
      this.child = null
      this.broadcast({ type: 'error', message: `Agent 进程退出（code=${code}）` })
    })
  }

  /** 发送 prompt（未就绪时排队） */
  prompt(text: string): void {
    if (!this.ready || !this.child) {
      this.pendingPrompts.push(text)
      return
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
          tokenUsage: { input: 0, output: 0 },
          cost: 0
        })
        return
      }
      const requestId = `req-${++this.requestSeq}`
      this.summaryWaiters.set(requestId, resolve)
      this.child.postMessage({ type: 'summary', requestId })
    })
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

  private handle(message: AgentOutbound): void {
    switch (message.type) {
      case 'ready': {
        this.ready = true
        const queued = this.pendingPrompts
        this.pendingPrompts = []
        for (const text of queued) this.prompt(text)
        break
      }
      case 'event':
        this.broadcast(message.event)
        break
      case 'summary': {
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
