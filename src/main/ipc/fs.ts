import { ipcMain, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { resolve, relative, join, basename } from 'node:path'
import { IPC } from '../../shared/ipc-types'
import type { FileNode } from '../../shared/ipc-types'
import { getWorkspace, selectWorkspace } from '../workspace'

/**
 * 文件系统 IPC。
 *
 * 安全约束：所有路径都必须落在当前工作区内，否则拒绝。
 * 这是 Agent 工作区限制在文件操作层的落地。
 */

function ensureInsideWorkspace(targetPath: string): string {
  const workspace = getWorkspace()
  if (!workspace) throw new Error('尚未选择工作区')
  const abs = resolve(workspace, targetPath)
  const rel = relative(workspace, abs)
  if (rel.startsWith('..') || resolve(abs) === resolve(workspace, '..')) {
    throw new Error(`路径越界（不在工作区内）：${targetPath}`)
  }
  return abs
}

function toNode(absPath: string, stats: import('node:fs').Stats): FileNode {
  const workspace = getWorkspace() ?? ''
  return {
    name: basename(absPath),
    path: absPath,
    relativePath: relative(workspace, absPath).replace(/\\/g, '/'),
    isDirectory: stats.isDirectory(),
    size: stats.size,
    modifiedAt: stats.mtimeMs
  }
}

const SEARCH_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'release',
  'dist',
  '.vite',
  '.cache',
  '.pax',
  '.pi'
])
const SEARCH_MAX_DEPTH = 4
const SEARCH_MAX_VISITED = 4000
const SEARCH_DEFAULT_LIMIT = 60

interface SearchHit {
  node: FileNode
  score: number
}

/**
 * 工作区内模糊搜索（供输入框 @ 引用使用）。
 *
 * 约束：只在当前工作区内递归（走 ensureInsideWorkspace ⟹ 越界不可能发生）；
 * 限深 + 限访问总数 + 限返回条数，避免大仓库把主进程拖死。
 */
async function searchWorkspace(query: string, limit: number): Promise<FileNode[]> {
  const workspace = getWorkspace()
  if (!workspace) throw new Error('尚未选择工作区')
  const needle = query.trim().toLowerCase()

  const hits: SearchHit[] = []
  let visited = 0
  const root = resolve(workspace)

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > SEARCH_MAX_DEPTH || visited > SEARCH_MAX_VISITED) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (visited > SEARCH_MAX_VISITED) return
      visited += 1
      if (entry.isDirectory() && SEARCH_SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith('.') && entry.isDirectory()) continue

      const absChild = join(dir, entry.name)
      const relPath = relative(root, absChild).replace(/\\/g, '/')
      const name = entry.name

      let isMatched = needle.length === 0
      let score = 99
      if (needle.length > 0) {
        const lowerName = name.toLowerCase()
        const lowerRel = relPath.toLowerCase()
        if (lowerName === needle) score = 0
        else if (lowerName.startsWith(needle)) score = 1
        else if (lowerName.includes(needle)) score = 2
        else if (lowerRel.includes(needle)) score = 3
        isMatched = score !== 99
      }

      if (isMatched) {
        try {
          const stats = await fs.stat(absChild)
          hits.push({ node: toNode(absChild, stats), score: score + (entry.isDirectory() ? 0.5 : 0) })
        } catch {
          // 跳过无权限/损坏项
        }
      }

      if (entry.isDirectory()) await walk(absChild, depth + 1)
    }
  }

  await walk(root, 0)

  return hits
    .sort((a, b) => (a.score === b.score ? a.node.relativePath.localeCompare(b.node.relativePath) : a.score - b.score))
    .slice(0, Math.max(1, Math.min(limit, 200)))
    .map((hit) => hit.node)
}

export function registerFsIpc(): void {
  ipcMain.handle(IPC.WORKSPACE_GET, async (): Promise<string | null> => getWorkspace())

  ipcMain.handle(IPC.WORKSPACE_SELECT, async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return selectWorkspace(win)
  })

  ipcMain.handle(IPC.FS_LIST, async (_event, dirPath: unknown): Promise<FileNode[]> => {
    const abs = ensureInsideWorkspace(typeof dirPath === 'string' ? dirPath : '.')
    const entries = await fs.readdir(abs, { withFileTypes: true })
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const absChild = join(abs, entry.name)
      try {
        const stats = await fs.stat(absChild)
        nodes.push(toNode(absChild, stats))
      } catch {
        // 跳过无权限/损坏项
      }
    }
    // 目录在前，再按名称排序
    return nodes.sort((a, b) =>
      a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1
    )
  })

  ipcMain.handle(
    IPC.FS_SEARCH,
    async (_event, query: unknown, limit: unknown): Promise<FileNode[]> =>
      searchWorkspace(typeof query === 'string' ? query : '', typeof limit === 'number' ? limit : SEARCH_DEFAULT_LIMIT)
  )

  ipcMain.handle(IPC.FS_READ, async (_event, filePath: unknown): Promise<string> => {
    const abs = ensureInsideWorkspace(String(filePath))
    const stats = await fs.stat(abs)
    if (stats.size > 5 * 1024 * 1024) throw new Error('文件过大（>5MB），暂不支持在编辑器打开')
    return fs.readFile(abs, 'utf-8')
  })

  ipcMain.handle(
    IPC.FS_WRITE,
    async (_event, filePath: unknown, content: unknown): Promise<void> => {
      const abs = ensureInsideWorkspace(String(filePath))
      await fs.writeFile(abs, String(content ?? ''), 'utf-8')
    }
  )

  ipcMain.handle(
    IPC.FS_CREATE,
    async (_event, parentDir: unknown, name: unknown, isDirectory: unknown): Promise<FileNode> => {
      const parent = ensureInsideWorkspace(String(parentDir))
      const target = join(parent, String(name))
      ensureInsideWorkspace(target)
      if (isDirectory === true) {
        await fs.mkdir(target, { recursive: false })
      } else {
        await fs.writeFile(target, '', { flag: 'wx' })
      }
      const stats = await fs.stat(target)
      return toNode(target, stats)
    }
  )

  ipcMain.handle(IPC.FS_DELETE, async (_event, targetPath: unknown): Promise<void> => {
    const abs = ensureInsideWorkspace(String(targetPath))
    const stats = await fs.stat(abs)
    if (stats.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: false })
    } else {
      await fs.unlink(abs)
    }
  })
}
