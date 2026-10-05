// 阶段三验证脚本：验证 pi-agent SDK + DeepSeek 环境变量配置真实可用。
// 运行：node scripts/verify-agent-sdk.mjs（需 DEEPSEEK_API_KEY）
import { ModelRuntime, createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent'

const runtime = await ModelRuntime.create({ allowModelNetwork: false })
const model = runtime.getModel('deepseek', 'deepseek-flash')
console.log('[verify] 解析到的模型:', model ? `${model.provider}/${model.id}` : '(未找到)')
if (!model) {
  const ids = runtime.getModels('deepseek').map((m) => m.id)
  console.log('[verify] deepseek 可用模型:', ids.join(', ') || '(无)')
  process.exit(1)
}

console.log('[verify] API Key 环境变量存在:', Boolean(process.env.DEEPSEEK_API_KEY))

const { session } = await createAgentSession({
  modelRuntime: runtime,
  model,
  sessionManager: SessionManager.inMemory()
})

let gotText = false
const done = new Promise((resolve) => {
  session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
      gotText = true
      process.stdout.write(event.assistantMessageEvent.delta)
    }
    if (event.type === 'agent_end') resolve()
  })
})

await session.prompt('用一句话回答：1+1 等于几？')
await done

console.log('\n[verify] 是否收到流式文本:', gotText)
session.dispose()
process.exit(gotText ? 0 : 1)
