import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { promisify } from 'node:util'
import { join, relative } from 'node:path'
import { Type } from 'typebox'
import { defineTool } from '@earendil-works/pi-coding-agent'
import type { ToolDefinition } from '@earendil-works/pi-coding-agent'

const execFileAsync = promisify(execFile)

/** 工具统一返回的文本结果 */
function text(value: string): {
  content: Array<{ type: 'text'; text: string }>
  details: Record<string, never>
} {
  return { content: [{ type: 'text', text: value }], details: {} }
}

/** 1. git_status：查看工作区 git 状态 */
export const gitStatusTool = defineTool({
  name: 'git_status',
  label: 'Git 状态',
  description:
    '查看当前工作区的 git 状态：当前分支与未提交变更。适合在改动代码前后确认仓库状态。',
  promptSnippet: '查看工作区 git 状态（分支 + 变更）',
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--short', '--branch'], {
        cwd: ctx.cwd
      })
      return text(stdout.trim() || '(工作区干净)')
    } catch (err) {
      return text(`git_status 失败：${String(err)}`)
    }
  }
})

/** 2. project_info：读取项目元信息 */
export const projectInfoTool = defineTool({
  name: 'project_info',
  label: '项目信息',
  description:
    '读取工作区 package.json 的项目名、版本、依赖数量与可用脚本。用于快速了解当前项目。',
  promptSnippet: '读取项目名/版本/脚本',
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
    try {
      const raw = await fs.readFile(join(ctx.cwd, 'package.json'), 'utf-8')
      const pkg = JSON.parse(raw) as Record<string, unknown>
      const deps = (pkg.dependencies ?? {}) as Record<string, unknown>
      const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>
      const scripts = (pkg.scripts ?? {}) as Record<string, unknown>
      const lines = [
        `name: ${String(pkg.name ?? '(未命名)')}`,
        `version: ${String(pkg.version ?? '(无)')}`,
        `description: ${String(pkg.description ?? '(无)')}`,
        `dependencies: ${Object.keys(deps).length}`,
        `devDependencies: ${Object.keys(devDeps).length}`,
        `scripts: ${Object.keys(scripts).join(', ') || '(无)'}`
      ]
      return text(lines.join('\n'))
    } catch (err) {
      return text(`project_info 失败（可能没有 package.json）：${String(err)}`)
    }
  }
})

/** 3. find_todos：搜索 TODO / FIXME 标记 */
export const findTodosTool = defineTool({
  name: 'find_todos',
  label: '搜索 TODO',
  description:
    '在指定目录（默认 src）递归搜索 TODO / FIXME / HACK 注释，返回文件与行号。用于盘点待办。',
  promptSnippet: '搜索 TODO/FIXME/HACK 注释',
  parameters: Type.Object({
    directory: Type.Optional(Type.String({ description: '要搜索的相对目录，默认 src' }))
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const dir = join(ctx.cwd, params.directory ?? 'src')
    const results: string[] = []
    const pattern = /\b(TODO|FIXME|HACK)\b/
    const exts = /\.(ts|tsx|js|jsx|css|md|py|go|rs|java)$/

    async function walk(current: string): Promise<void> {
      let entries: import('node:fs').Dirent[]
      try {
        entries = await fs.readdir(current, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        const full = join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        if (!exts.test(entry.name)) continue
        try {
          const content = await fs.readFile(full, 'utf-8')
          content.split('\n').forEach((line, i) => {
            if (pattern.test(line)) {
              results.push(
                `${relative(ctx.cwd, full).replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 100)}`
              )
            }
          })
        } catch {
          // 跳过不可读文件
        }
      }
    }

    await walk(dir)
    if (results.length === 0) {
      return text(`未在 ${params.directory ?? 'src'} 找到 TODO/FIXME/HACK`)
    }
    return text(`找到 ${results.length} 处：\n${results.slice(0, 100).join('\n')}`)
  }
})

/** 4. count_lines：统计代码行数 */
export const countLinesTool = defineTool({
  name: 'count_lines',
  label: '统计行数',
  description: '统计指定目录（默认 src）下各语言文件的数量与代码行数。用于评估代码规模。',
  promptSnippet: '统计目录代码行数',
  parameters: Type.Object({
    directory: Type.Optional(Type.String({ description: '要统计的相对目录，默认 src' }))
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const dir = join(ctx.cwd, params.directory ?? 'src')
    const byExt: Record<string, { files: number; lines: number }> = {}

    async function walk(current: string): Promise<void> {
      let entries: import('node:fs').Dirent[]
      try {
        entries = await fs.readdir(current, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        const full = join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? 'other'
        try {
          const content = await fs.readFile(full, 'utf-8')
          const lines = content.split('\n').length
          byExt[ext] ??= { files: 0, lines: 0 }
          byExt[ext].files += 1
          byExt[ext].lines += lines
        } catch {
          // 跳过
        }
      }
    }

    await walk(dir)
    const rows = Object.entries(byExt).sort((a, b) => b[1].lines - a[1].lines)
    if (rows.length === 0) return text(`目录 ${params.directory ?? 'src'} 没有可统计的文件`)
    const total = rows.reduce((sum, [, v]) => sum + v.lines, 0)
    const body = rows
      .map(
        ([ext, v]) =>
          `  ${ext.padEnd(8)} ${String(v.files).padStart(4)} 文件  ${String(v.lines).padStart(6)} 行`
      )
      .join('\n')
    return text(`共 ${total} 行\n${body}`)
  }
})

/** 全部静态内置工具（通过 createAgentSession({ customTools }) 注册） */
export const builtinTools: ToolDefinition[] = [
  gitStatusTool,
  projectInfoTool,
  findTodosTool,
  countLinesTool
]
