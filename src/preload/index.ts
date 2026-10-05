import { contextBridge } from 'electron'

// 阶段一：只暴露一个最小探针，用于验证 contextBridge 通路。
// 完整白名单 API（sendPrompt / approveToolCall / getSessionSummary / onAgentEvent）
// 在阶段二实现。
const api = {
  ping: (): string => 'pong'
}

contextBridge.exposeInMainWorld('piforge', api)
