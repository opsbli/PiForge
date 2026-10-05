import type { FileNode, SessionListItem, SkillInfo, ToolInfoLite } from '@shared/ipc-types'

/**
 * 输入框引用（@ 文件 / / Skill / # MCP / & 会话）。
 *
 * 设计：输入时按触发符弹出候选，选中后**只把标记写进文本**（如 `@src/main/index.ts`）；
 * 真正解析发生在发送时（buildReferenceBlock），把标记解析成引用块交给模型。
 */

export type MentionKind = '@' | '/' | '#' | '&'

export interface MentionTrigger {
  kind: MentionKind
  /** 触发符之后的已输入内容 */
  query: string
  /** 触发符在文本中的下标 */
  start: number
}

export interface MentionItem {
  key: string
  label: string
  hint: string
  /** 插入到文本里的内容（不含触发符） */
  insert: string
  /**
   * 选中后的实际载荷。
   *
   * `@` 文件引用选中后不写文本标记，而是与 📎 一致地变成输入框内部的 chip，
   * 所以这里带绝对路径供 chip 列表使用。
   */
  payload?: string
}

interface MentionMeta {
  kind: MentionKind
  title: string
  empty: string
}

export const MENTION_META: Record<MentionKind, MentionMeta> = {
  '@': { kind: '@', title: '引用文件', empty: '没有匹配的文件' },
  '/': { kind: '/', title: '调用 Skill', empty: '没有匹配的 Skill' },
  '#': { kind: '#', title: '使用 MCP', empty: '没有已加载的 MCP 工具' },
  '&': { kind: '&', title: '引用会话', empty: '没有匹配的会话' }
}

const TRIGGER_CHARS: MentionKind[] = ['@', '/', '#', '&']

/** 标记内部允许的字符 */
const TOKEN_CHAR = /[\w.\-\u4e00-\u9fa5]/
/** 标记前面的字符：只要不是词字符/路径字符/标记符就算分界（含中文全角标点） */
const TOKEN_PREFIX = `(^|[^\\w.\\-\\u4e00-\\u9fa5@#&/])`

function isTriggerChar(value: string): value is MentionKind {
  return (TRIGGER_CHARS as string[]).includes(value)
}

/** 触发符允许出现的位置：行首、空白之后、左括号之后 */
function isTriggerStart(prev: string): boolean {
  return prev === '' || !TOKEN_CHAR.test(prev)
}

/**
 * 从 caret 往前找出当前正在输入的引用标记。
 * 找不到或不该触发时返回 null（例如 `a@b.com` 里的 @ 不触发）。
 */
export function findMentionTrigger(text: string, caret: number): MentionTrigger | null {
  if (caret <= 0) return null
  const before = text.slice(0, caret)

  for (let index = before.length - 1; index >= 0; index -= 1) {
    const char = before[index]
    if (/\s/.test(char)) return null
    if (!isTriggerChar(char)) continue

    const prev = index > 0 ? before[index - 1] : ''
    // 不是 token 起点（如路径里的 `/`、邮箱里的 `@`）→ 继续往左找
    if (!isTriggerStart(prev)) continue

    const query = before.slice(index + 1)
    if (!isValidQuery(char, query)) return null
    return { kind: char, query, start: index }
  }
  return null
}

function isValidQuery(kind: MentionKind, query: string): boolean {
  if (/\s/.test(query)) return false
  // 文件路径允许包含 `/`，其余引用名不允许再出现任何触发符
  return kind === '@' ? !/[@#&]/.test(query) : !/[@/#&]/.test(query)
}

// ---- 数据源（进程内缓存，避免每次按键都打 IPC）----

let skillsCache: SkillInfo[] | null = null
let mcpToolsCache: ToolInfoLite[] | null = null
let sessionsCache: SessionListItem[] | null = null

export async function loadSkills(): Promise<SkillInfo[]> {
  if (skillsCache) return skillsCache
  try {
    const snapshot = await window.piforge.readResources()
    skillsCache = snapshot?.skills ?? []
  } catch {
    skillsCache = []
  }
  return skillsCache
}

export async function loadMcpTools(): Promise<ToolInfoLite[]> {
  if (mcpToolsCache) return mcpToolsCache
  try {
    const snapshot = await window.piforge.readResources()
    mcpToolsCache = (snapshot?.tools ?? []).filter((tool) => tool.origin === 'mcp')
  } catch {
    mcpToolsCache = []
  }
  return mcpToolsCache
}

export async function loadSessions(): Promise<SessionListItem[]> {
  if (sessionsCache) return sessionsCache
  try {
    sessionsCache = (await window.piforge.listAllSessions()) ?? []
  } catch {
    sessionsCache = []
  }
  return sessionsCache
}

/** 清空缓存（例如 MCP/Skill 配置变更后） */
export function resetMentionCaches(): void {
  skillsCache = null
  mcpToolsCache = null
  sessionsCache = null
}

function matches(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle)
}

export function sessionLabel(item: SessionListItem): string {
  const label = item.name?.trim() || item.firstMessage?.trim() || item.id.slice(0, 8)
  return label.length > 48 ? `${label.slice(0, 48)}…` : label
}

/** 按触发类型给出候选列表 */
export async function buildMentionItems(
  kind: MentionKind,
  query: string
): Promise<MentionItem[]> {
  const needle = query.trim().toLowerCase()

  if (kind === '@') {
    let files: FileNode[] = []
    try {
      files = await window.piforge.searchFiles(query, 40)
    } catch {
      files = []
    }
    return files
      .filter((file) => needle === '' || matches(file.relativePath, needle))
      .slice(0, 40)
      .map((file) => ({
        key: `@${file.relativePath}`,
        label: file.relativePath,
        hint: file.isDirectory ? '文件夹' : '文件',
        insert: file.relativePath,
        payload: file.path
      }))
  }

  if (kind === '/') {
    const skills = await loadSkills()
    return skills
      .filter((skill) => needle === '' || matches(skill.name, needle) || matches(skill.description, needle))
      .slice(0, 40)
      .map((skill) => ({
        key: `/${skill.name}`,
        label: skill.name,
        hint: skill.description?.slice(0, 60) ?? '',
        insert: skill.name
      }))
  }

  if (kind === '#') {
    const tools = await loadMcpTools()
    return tools
      .filter((tool) => needle === '' || matches(tool.name, needle) || matches(tool.server ?? '', needle))
      .slice(0, 40)
      .map((tool) => ({
        key: `#${tool.name}`,
        label: tool.name,
        hint: tool.server ? `MCP · ${tool.server}` : 'MCP',
        insert: tool.name
      }))
  }

  const sessions = await loadSessions()
  return sessions
    .filter((item) => {
      if (needle === '') return true
      return (
        matches(item.id, needle) ||
        matches(sessionLabel(item), needle) ||
        matches(item.firstMessage ?? '', needle)
      )
    })
    .slice(0, 40)
    .map((item) => ({
      key: `&${item.id}`,
      label: sessionLabel(item),
      hint: `${item.id.slice(0, 8)} · ${item.messageCount} 条消息`,
      insert: item.id
    }))
}

// ---- 发送时解析 ----

export interface ParsedReferences {
  files: string[]
  skills: string[]
  mcpTools: string[]
  sessions: SessionListItem[]
}

/**
 * 从捕获到的原始片段里取有效标记。
 *
 * 中文正文没有空格分词，标记后面常常紧跟全角标点（如 `@a/b.md，`），
 * 若不裁剪就会把标点吞进标记导致解析失败。
 */
function cleanToken(kind: MentionKind, raw: string): string {
  const pattern =
    kind === '@' ? /^[\w./\\\-\u4e00-\u9fa5]+/ : /^[\w.\-\u4e00-\u9fa5]+/
  return raw.match(pattern)?.[0] ?? ''
}

function collect(text: string, kind: MentionKind): string[] {
  const trigger = kind === '@' ? '@' : kind === '/' ? '\\/' : kind === '#' ? '#' : '&'
  const pattern = new RegExp(`${TOKEN_PREFIX}${trigger}([^\\s@#&/]+)`, 'g')
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const value = cleanToken(kind, match[2] ?? '')
    if (value && !found.includes(value)) found.push(value)
    // 允许 `@` 出现在路径里：整体匹配失败时把游标推进一格，避免死循环
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1
  }
  return found
}

/** 收集引用文件路径（`@` 允许包含 `/`，单独处理） */
function collectFilePaths(text: string): string[] {
  const pattern = new RegExp(`${TOKEN_PREFIX}@([^\\s@#&]+)`, 'g')
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const value = cleanToken('@', match[2] ?? '')
    if (value && /[./]/.test(value) && !found.includes(value)) found.push(value)
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1
  }
  return found
}

/** 把文本里的引用标记解析为引用块；没有任何有效引用时返回空串 */
export async function buildReferenceBlock(
  text: string,
  attachments: string[]
): Promise<string> {
  const files = [...attachments, ...collectFilePaths(text)]
  const skillNames = collect(text, '/')
  const toolNames = collect(text, '#')
  const sessionTokens = collect(text, '&')

  const [skills, tools, sessions] = await Promise.all([
    skillNames.length > 0 ? loadSkills() : Promise.resolve<SkillInfo[]>([]),
    toolNames.length > 0 ? loadMcpTools() : Promise.resolve<ToolInfoLite[]>([]),
    sessionTokens.length > 0 ? loadSessions() : Promise.resolve<SessionListItem[]>([])
  ])

  const resolvedSkills = skills.filter((skill) => skillNames.includes(skill.name))
  const resolvedTools = tools.filter((tool) => toolNames.includes(tool.name))
  const resolvedSessions = sessions.filter(
    (item) => sessionTokens.includes(item.id) || sessionTokens.includes(sessionLabel(item))
  )

  const sections: string[] = []
  if (files.length > 0) {
    sections.push(`引用文件（本地路径）：\n${files.map((path) => `- ${path}`).join('\n')}`)
  }
  if (resolvedSkills.length > 0) {
    sections.push(
      `调用 Skill（请使用这些 Skill 完成任务）：\n${resolvedSkills.map((skill) => `- ${skill.name}`).join('\n')}`
    )
  }
  if (resolvedTools.length > 0) {
    sections.push(
      `使用 MCP 工具：\n${resolvedTools.map((tool) => `- ${tool.name}${tool.server ? `（server: ${tool.server}）` : ''}`).join('\n')}`
    )
  }
  if (resolvedSessions.length > 0) {
    sections.push(
      `引用会话：\n${resolvedSessions.map((item) => `- ${sessionLabel(item)}（id: ${item.id}）`).join('\n')}`
    )
  }

  return sections.join('\n\n')
}
