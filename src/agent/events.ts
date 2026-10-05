import type { AgentEvent } from '../shared/agent-events'

/**
 * pi-agent SDK 的 `AgentSessionEvent` → 前端 `AgentEvent` 的映射。
 *
 * 只透出 UI 需要的事件，其余（queue_update / compaction_* / auto_retry_* 等）
 * 返回 null，由调用方跳过。SDK 的事件形状来自 pi-agent-core 的 AgentEvent：
 *   - message_update 携带 assistantMessageEvent，文本增量在
 *     assistantMessageEvent.type === 'text_delta' 的 `delta` 字段。
 *   - tool_execution_start/end 才是工具调用，字段是 toolCallId / toolName。
 */
export function mapSdkEvent(event: unknown): AgentEvent | null {
  if (!event || typeof event !== 'object') return null
  const e = event as Record<string, any>

  switch (e.type) {
    case 'message_start': {
      const id = e.message?.id ?? e.message?.messageId ?? 'unknown'
      return { type: 'message_start', messageId: String(id) }
    }

    case 'message_update': {
      const deltaEvt = e.assistantMessageEvent
      if (deltaEvt?.type === 'text_delta' && typeof deltaEvt.delta === 'string') {
        return { type: 'message_delta', text: deltaEvt.delta }
      }
      return null
    }

    case 'message_end': {
      const id = e.message?.id ?? e.message?.messageId ?? 'unknown'
      return { type: 'message_end', messageId: String(id) }
    }

    case 'tool_execution_start': {
      return {
        type: 'tool_call_start',
        callId: String(e.toolCallId ?? ''),
        tool: String(e.toolName ?? 'unknown'),
        args: e.args
      }
    }

    case 'tool_execution_end': {
      return {
        type: 'tool_call_end',
        callId: String(e.toolCallId ?? ''),
        ok: !e.isError,
        result: e.result,
        error: e.isError ? String(e.result ?? 'tool failed') : undefined
      }
    }

    case 'turn_end':
      return { type: 'turn_end' }

    default:
      return null
  }
}
