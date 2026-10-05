import { promises as fs } from 'node:fs'
import { join } from 'node:path'
// type-only 导入（TS 擦除）——SDK 是 ESM-only，不能静态 import
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'

/**
 * 项目本地记忆系统（阶段十）。
 *
 * 布局：
 *   <workspace>/.pi/memory/
 *     ├─ MEMORY.md          # 索引（一行一条）
 *     └─ <name>.md          # 每条记忆一个文件（含 frontmatter）
 *
 * 注入：before_agent_start 时把 MEMORY.md 索引写进 systemPromptOptions.sections.memory，
 * SDK 会把它作为独立 <memory> section 追加到 system prompt（不覆盖默认 prompt）。
 */

export type MemoryType = 'decision' | 'preference' | 'fact' | 'debug_history'

export const MEMORY_TYPES: Array<{ value: MemoryType; label: string }> = [
  { value: 'decision', label: '决策' },
  { value: 'preference', label: '偏好' },
  { value: 'fact', label: '事实' },
  { value: 'debug_history', label: '调试历史' }
]

export interface MemoryEntry {
  /** 文件名（不含 .md） */
  name: string
  description: string
  type: MemoryType
  created: string
  modified: string
  /** 正文（frontmatter 之后） */
  body: string
}

const INDEX_FILE = 'MEMORY.md'

export function memoryDir(workspace: string): string {
  return join(workspace, '.pi', 'memory')
}

function memoryPath(workspace: string, name: string): string {
  return join(memoryDir(workspace), `${name}.md`)
}

/** 解析 frontmatter（--- 包裹的 key: value） */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return { meta, body: match[2] }
}

function serialize(entry: MemoryEntry): string {
  return [
    '---',
    `name: ${entry.name}`,
    `description: ${entry.description}`,
    `type: ${entry.type}`,
    `created: ${entry.created}`,
    `modified: ${entry.modified}`,
    '---',
    '',
    entry.body.trim(),
    ''
  ].join('\n')
}

/** 列出全部记忆（不含索引文件） */
export async function listMemories(workspace: string): Promise<MemoryEntry[]> {
  const dir = memoryDir(workspace)
  let files: string[]
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const entries: MemoryEntry[] = []
  for (const file of files) {
    if (!file.endsWith('.md') || file === INDEX_FILE) continue
    try {
      const raw = await fs.readFile(join(dir, file), 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      entries.push({
        name: meta.name || file.replace(/\.md$/, ''),
        description: meta.description ?? '',
        type: (meta.type as MemoryType) || 'fact',
        created: meta.created ?? '',
        modified: meta.modified ?? '',
        body: body.trim()
      })
    } catch {
      // 跳过损坏文件
    }
  }
  return entries.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
}

/** 读取单条记忆 */
export async function readMemory(workspace: string, name: string): Promise<MemoryEntry | null> {
  try {
    const raw = await fs.readFile(memoryPath(workspace, name), 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    return {
      name,
      description: meta.description ?? '',
      type: (meta.type as MemoryType) || 'fact',
      created: meta.created ?? '',
      modified: meta.modified ?? '',
      body: body.trim()
    }
  } catch {
    return null
  }
}

/** 写入/更新一条记忆，并重建索引 */
export async function writeMemory(
  workspace: string,
  entry: Omit<MemoryEntry, 'created' | 'modified'> & { created?: string }
): Promise<MemoryEntry> {
  const dir = memoryDir(workspace)
  await fs.mkdir(dir, { recursive: true })
  const now = new Date().toISOString()
  const existing = await readMemory(workspace, entry.name)
  const full: MemoryEntry = {
    name: entry.name,
    description: entry.description,
    type: entry.type,
    created: existing?.created || entry.created || now,
    modified: now,
    body: entry.body
  }
  await fs.writeFile(memoryPath(workspace, entry.name), serialize(full), 'utf-8')
  await rebuildIndex(workspace)
  return full
}

/** 删除一条记忆，并重建索引 */
export async function deleteMemory(workspace: string, name: string): Promise<void> {
  try {
    await fs.unlink(memoryPath(workspace, name))
  } catch {
    // 已不存在
  }
  await rebuildIndex(workspace)
}

/** 重建 MEMORY.md 索引 */
export async function rebuildIndex(workspace: string): Promise<string> {
  const entries = await listMemories(workspace)
  const lines = ['# 记忆索引', '']
  for (const e of entries) {
    lines.push(`- [${e.name}](${e.name}.md) — ${e.description || '(无描述)'}`)
  }
  const content = lines.join('\n') + '\n'
  const dir = memoryDir(workspace)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, INDEX_FILE), content, 'utf-8')
  return content
}

/** 读取索引内容（不存在返回空串） */
export async function readIndex(workspace: string): Promise<string> {
  try {
    return (await fs.readFile(join(memoryDir(workspace), INDEX_FILE), 'utf-8')).trim()
  } catch {
    return ''
  }
}

/**
 * 记忆注入扩展：before_agent_start 时把索引追加为 systemPromptOptions.sections.memory。
 * 这样保留 SDK 默认 prompt，只是多一个 <memory> section。
 */
export function createMemoryExtension(workspace: string): ExtensionFactory {
  return (pi): void => {
    pi.on('before_agent_start', async (event) => {
      try {
        const index = await readIndex(workspace)
        if (!index) return
        // sections 是可变对象；这里只新增 memory 段，不改其他段
        event.systemPromptOptions.sections = {
          ...event.systemPromptOptions.sections,
          memory: index
        }
      } catch {
        // 记忆读取失败不影响正常对话
      }
    })
  }
}
