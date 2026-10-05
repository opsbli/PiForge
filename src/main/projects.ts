import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { IPC } from '../shared/ipc-types'
import type { ProjectRecord, ProjectState } from '../shared/ipc-types'
import { setWorkspace } from './workspace'
import { agentHost } from './agent-host'

/**
 * 多项目注册表。
 *
 * 主进程是项目列表的唯一事实来源：登记信息持久化到 userData/projects.json，
 * 任何增删改激活都会广播给渲染进程。切换激活项目会同步工作区并重启 agent
 * （agent 的 settings / trust / 工具集都绑定在 cwd 上）。
 *
 * 安全边界：
 * - `local` 项目的文件由用户掌管，删除项目只移除登记，绝不删除磁盘内容。
 * - `blank` 项目的目录位于 userData 下、由本应用创建，删除时一并清理。
 */

const registryFile = (): string => join(app.getPath('userData'), 'projects.json')
const blankRoot = (): string => join(app.getPath('userData'), 'projects')

let state: ProjectState = { projects: [], activeProjectId: null }

function now(): string {
  return new Date().toISOString()
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.PROJECT_CHANGED, state)
  }
}

async function persist(): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(registryFile(), JSON.stringify(state, null, 2), 'utf-8')
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.path === 'string' &&
    (record.kind === 'local' || record.kind === 'blank')
  )
}

/** 读取持久化内容并做最小校验；无法解析时回退为空列表 */
function normalize(raw: unknown): ProjectState {
  const data = (raw ?? {}) as Record<string, unknown>
  const projects = Array.isArray(data.projects) ? data.projects.filter(isProjectRecord) : []
  const active = typeof data.activeProjectId === 'string' ? data.activeProjectId : null
  return {
    projects,
    activeProjectId: projects.some((p) => p.id === active) ? active : (projects[0]?.id ?? null)
  }
}

/**
 * 启动时初始化项目列表：读取登记；为空（首次运行）时把 seedPath 登记为本地项目。
 * 返回需要作为 agent 工作区的绝对路径。
 */
export async function initProjects(seedPath: string): Promise<string> {
  try {
    state = normalize(JSON.parse(await fs.readFile(registryFile(), 'utf-8')) as unknown)
  } catch {
    state = { projects: [], activeProjectId: null }
  }

  if (state.projects.length === 0) {
    const path = resolve(seedPath)
    const record: ProjectRecord = {
      id: randomUUID(),
      name: basename(path) || path,
      path,
      kind: 'local',
      createdAt: now(),
      lastOpenedAt: now()
    }
    state = { projects: [record], activeProjectId: record.id }
    await persist()
  }

  const active = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0]
  setWorkspace(active.path)
  return active.path
}

export function getProjectState(): ProjectState {
  return state
}

function find(id: string): ProjectRecord | undefined {
  return state.projects.find((p) => p.id === id)
}

/**
 * 把项目设为激活：同步工作区；仅当切换到了不同项目时才重启 agent，
 * 重复激活当前项目不触发重启（避免启动后的一次多余重启）。
 */
function activateRecord(record: ProjectRecord): void {
  const switched = state.activeProjectId !== record.id
  state.activeProjectId = record.id
  record.lastOpenedAt = now()
  setWorkspace(record.path)
  if (switched) agentHost.restart(record.path)
}

/** 弹出文件夹选择框创建（或打开）本地项目；取消返回 null */
export async function createProjectFromFolder(
  win: BrowserWindow | null
): Promise<ProjectState | null> {
  const options = {
    title: '选择项目文件夹',
    properties: ['openDirectory' as const, 'createDirectory' as const]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null

  const path = resolve(result.filePaths[0])
  const existing = state.projects.find((p) => resolve(p.path) === path)

  if (existing) {
    activateRecord(existing)
  } else {
    const record: ProjectRecord = {
      id: randomUUID(),
      name: basename(path) || path,
      path,
      kind: 'local',
      createdAt: now(),
      lastOpenedAt: now()
    }
    state.projects.push(record)
    activateRecord(record)
  }

  await persist()
  broadcast()
  return state
}

/** 新建空白项目：在 userData 下分配目录并登记 */
export async function createBlankProject(name?: string): Promise<ProjectState> {
  const id = randomUUID()
  const path = join(blankRoot(), id)
  await fs.mkdir(path, { recursive: true })

  const record: ProjectRecord = {
    id,
    name: name?.trim() || '未命名项目',
    path,
    kind: 'blank',
    createdAt: now(),
    lastOpenedAt: now()
  }
  state.projects.push(record)
  activateRecord(record)

  await persist()
  broadcast()
  return state
}

/** 重命名项目（只改展示名，不改变磁盘目录） */
export async function renameProject(id: string, name: string): Promise<ProjectState> {
  const record = find(id)
  const trimmed = name.trim()
  if (record && trimmed) {
    record.name = trimmed
    await persist()
    broadcast()
  }
  return state
}

/** 删除项目登记；本地项目不动文件，空白项目清理其受管目录 */
export async function removeProject(id: string): Promise<ProjectState> {
  const record = find(id)
  if (!record) return state

  state.projects = state.projects.filter((p) => p.id !== id)

  if (state.activeProjectId === id) {
    const next = state.projects[0] ?? null
    state.activeProjectId = next?.id ?? null
    if (next) activateRecord(next)
  }

  await persist()
  broadcast()

  if (record.kind === 'blank') {
    try {
      await fs.rm(record.path, { recursive: true, force: true })
    } catch {
      // 清理失败不影响登记删除结果
    }
  }
  return state
}

export async function activateProject(id: string): Promise<ProjectState> {
  const record = find(id)
  if (!record) return state
  activateRecord(record)
  await persist()
  broadcast()
  return state
}
