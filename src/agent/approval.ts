import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { assessToolCall } from '../shared/safety'
import type { ApprovalMode, ApprovalRequest } from '../shared/ipc-types'

export type { ApprovalRequest }

/** 把审批请求送到 UI 并等待用户决定 */
export interface ApprovalBridge {
  request(request: ApprovalRequest): Promise<boolean>
}

/**
 * 危险操作审批扩展。
 *
 * 用 SDK 原生的 `pi.on("tool_call")` 作为拦截点：
 *   - handler 是 async，可以 `await` 用户审批后再决定是否 block。
 *   - 返回 `{ block: true, reason }` 会阻止工具执行并把原因交回模型。
 */
export function createApprovalExtension(
  workspace: string,
  bridge: ApprovalBridge,
  /** 当前审批模式：auto = 完全自动放行，ask = 危险操作弹窗（默认） */
  getMode: () => ApprovalMode = () => 'ask'
): ExtensionFactory {
  return (pi: ExtensionAPI): void => {
    pi.on('tool_call', async (event): Promise<{ block: boolean; reason: string } | void> => {
      const e = event as unknown as { toolName?: string; toolCallId?: string; input?: unknown }
      const toolName = String(e.toolName ?? '')
      if (!toolName) return

      // 完全自动：所有工具调用直接允许，不做危险判定也不弹窗
      if (getMode() === 'auto') return

      const verdict = assessToolCall(toolName, e.input, workspace)
      if (!verdict.dangerous) return

      const input = (e.input ?? {}) as Record<string, unknown>
      const approved = await bridge.request({
        callId: String(e.toolCallId ?? ''),
        tool: toolName,
        command: toolName === 'bash' ? String(input.command ?? '') : undefined,
        detail: safeStringify(e.input),
        reason: verdict.reason ?? '危险操作',
        rule: verdict.rule
      })

      if (!approved) {
        return { block: true, reason: `用户拒绝执行：${verdict.reason ?? '危险操作'}` }
      }
    })
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
