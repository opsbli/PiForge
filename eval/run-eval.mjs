// PiForge 本地评估脚本：跑预定义用例，结果写入 SQLite（evals 表）。
// 运行：node eval/run-eval.mjs（需 DEEPSEEK_API_KEY）
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  ModelRuntime,
  createAgentSession,
  SessionManager,
  defineTool
} from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---- 与 src/agent/tools 同构的最小工具集（供评估用） ----
const tools = [
  defineTool({
    name: 'count_lines',
    label: '统计行数',
    description: '统计指定目录（默认 src）下各语言文件的代码行数',
    parameters: Type.Object({
      directory: Type.Optional(Type.String({ description: '目录，默认 src' }))
    }),
    async execute(_id, params, _s, _u, ctx) {
      const { promises: fs } = await import('node:fs')
      const dir = join(ctx.cwd, params.directory ?? 'src')
      let total = 0
      async function walk(cur) {
        let entries
        try {
          entries = await fs.readdir(cur, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.git') continue
          const full = join(cur, e.name)
          if (e.isDirectory()) await walk(full)
          else {
            try {
              total += (await fs.readFile(full, 'utf-8')).split('\n').length
            } catch {
              /* skip */
            }
          }
        }
      }
      await walk(dir)
      return { content: [{ type: 'text', text: `共 ${total} 行` }], details: {} }
    }
  }),
  defineTool({
    name: 'git_status',
    label: 'Git 状态',
    description: '查看当前工作区的 git 状态',
    parameters: Type.Object({}),
    async execute(_id, _p, _s, _u, ctx) {
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      try {
        const { stdout } = await promisify(execFile)('git', ['status', '--short', '--branch'], {
          cwd: ctx.cwd
        })
        return { content: [{ type: 'text', text: stdout }], details: {} }
      } catch (e) {
        return { content: [{ type: 'text', text: String(e) }], details: {} }
      }
    }
  }),
  defineTool({
    name: 'project_info',
    label: '项目信息',
    description: '读取工作区 package.json 的项目名、版本、脚本',
    parameters: Type.Object({}),
    async execute(_id, _p, _s, _u, ctx) {
      const { promises: fs } = await import('node:fs')
      try {
        const pkg = JSON.parse(await fs.readFile(join(ctx.cwd, 'package.json'), 'utf-8'))
        return {
          content: [
            { type: 'text', text: `name=${pkg.name} version=${pkg.version} main=${pkg.main}` }
          ],
          details: {}
        }
      } catch (e) {
        return { content: [{ type: 'text', text: String(e) }], details: {} }
      }
    }
  })
]

// ---- 结果库 ----
const dbPath = process.env.PIFORGE_EVAL_DB ?? join(ROOT, 'eval', 'evals.db')
mkdirSync(dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS evals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at INTEGER NOT NULL,
    case_id TEXT NOT NULL,
    type TEXT NOT NULL,
    passed INTEGER NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0
  );
`)

const suite = JSON.parse(readFileSync(join(__dirname, 'cases.json'), 'utf-8'))
const runtime = await ModelRuntime.create({ allowModelNetwork: false })
const model = runtime.getModel('deepseek', 'deepseek-flash')
if (!model) {
  console.log('未找到模型')
  process.exit(1)
}

const insert = db.prepare(
  `INSERT INTO evals (run_at, case_id, type, passed, detail, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`
)

const results = []
for (const c of suite.cases) {
  const started = Date.now()
  const { session } = await createAgentSession({
    cwd: ROOT,
    modelRuntime: runtime,
    model,
    sessionManager: SessionManager.inMemory(),
    customTools: tools
  })

  let answer = ''
  const calledTools = []
  const done = new Promise((resolve) => {
    session.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        answer += event.assistantMessageEvent.delta
      }
      if (event.type === 'tool_execution_start') calledTools.push(event.toolName)
      if (event.type === 'agent_end') resolve()
    })
  })

  await session.prompt(c.prompt)
  await done

  let passed = false
  let detail = ''
  if (c.type === 'tool_accuracy') {
    passed = calledTools.includes(c.expectTool)
    detail = `调用工具: ${calledTools.join(',') || '(无)'}`
  } else {
    passed = c.expectPattern ? new RegExp(c.expectPattern, 'i').test(answer) : answer.length > 0
    detail = answer.trim().slice(0, 120)
  }

  const duration = Date.now() - started
  insert.run(Date.now(), c.id, c.type, passed ? 1 : 0, detail, duration)
  results.push({ id: c.id, type: c.type, passed, detail, duration })
  session.dispose()
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${c.id} (${c.type}) — ${detail}`)
}

// ---- 汇总 ----
const byType = {}
for (const r of results) {
  byType[r.type] ??= { pass: 0, total: 0 }
  byType[r.type].total++
  if (r.passed) byType[r.type].pass++
}
console.log('\n=== 汇总 ===')
for (const [type, v] of Object.entries(byType)) {
  console.log(`  ${type}: ${v.pass}/${v.total} (${((v.pass / v.total) * 100).toFixed(0)}%)`)
}
const totalPass = results.filter((r) => r.passed).length
console.log(`  总计: ${totalPass}/${results.length}`)
console.log(`\n结果已写入 ${dbPath}`)

db.close()
process.exit(0)
