// 阶段九验证：确认 SDK 的 customTools 机制可用（工具注册 + 模型调用）。
// 运行：node scripts/verify-tools.mjs（需 DEEPSEEK_API_KEY）
import {
  ModelRuntime,
  createAgentSession,
  SessionManager,
  defineTool
} from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

const runtime = await ModelRuntime.create({ allowModelNetwork: false })
const model = runtime.getModel('deepseek', 'deepseek-flash')
if (!model) {
  console.log('[verify] 未找到模型')
  process.exit(1)
}

// 与 src/agent/tools/index.ts 同构的测试工具
const echoTool = defineTool({
  name: 'count_lines_probe',
  label: '行数探针',
  description: '返回给定路径下 src 目录的代码行数（测试用）',
  promptSnippet: '统计代码行数',
  parameters: Type.Object({
    directory: Type.Optional(Type.String({ description: '目录，默认 src' }))
  }),
  async execute(_id, params) {
    return {
      content: [{ type: 'text', text: `探针收到目录参数：${params.directory ?? '(未提供)'}` }],
      details: {}
    }
  }
})

const { session } = await createAgentSession({
  modelRuntime: runtime,
  model,
  sessionManager: SessionManager.inMemory(),
  customTools: [echoTool]
})

const names = session.getActiveToolNames()
console.log('[verify] 已注册工具:', names.join(', ') || '(无)')
const registered = names.includes('count_lines_probe')
console.log('[verify] 自定义工具已注册:', registered)

let toolCalled = false
let toolName = ''
const done = new Promise((resolve) => {
  session.subscribe((event) => {
    if (event.type === 'tool_execution_start') {
      toolCalled = true
      toolName = event.toolName
    }
    if (event.type === 'agent_end') resolve()
  })
})

await session.prompt('请调用 count_lines_probe 工具，传入 directory="src"，然后告诉我它返回了什么。')
await done

console.log('[verify] 模型是否调用自定义工具:', toolCalled, toolCalled ? `(${toolName})` : '')
session.dispose()
process.exit(registered && toolCalled ? 0 : 1)
