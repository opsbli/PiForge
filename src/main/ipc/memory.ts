import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import { getWorkspace } from '../workspace'
import {
  listMemories,
  readMemory,
  writeMemory,
  deleteMemory,
  readIndex,
  rebuildIndex
} from '../../agent/memory'

/**
 * 记忆管理 IPC。
 *
 * 记忆存放在项目本地 <workspace>/.pi/memory/。
 * 所有操作限定在当前工作区内（memoryDir 基于 workspace 拼接）。
 */
export function registerMemoryIpc(): void {
  ipcMain.handle(IPC.MEMORY_LIST, async () => {
    const workspace = getWorkspace()
    if (!workspace) return []
    return listMemories(workspace)
  })

  ipcMain.handle(IPC.MEMORY_READ, async (_event, name: unknown) => {
    const workspace = getWorkspace()
    if (!workspace || typeof name !== 'string') return null
    return readMemory(workspace, name)
  })

  ipcMain.handle(IPC.MEMORY_WRITE, async (_event, payload: unknown) => {
    const workspace = getWorkspace()
    if (!workspace) throw new Error('尚未选择工作区')
    const p = (payload ?? {}) as {
      name?: string
      description?: string
      type?: string
      body?: string
    }
    if (!p.name) throw new Error('记忆名不能为空')
    return writeMemory(workspace, {
      name: p.name,
      description: p.description ?? '',
      type: (p.type as never) ?? 'fact',
      body: p.body ?? ''
    })
  })

  ipcMain.handle(IPC.MEMORY_DELETE, async (_event, name: unknown) => {
    const workspace = getWorkspace()
    if (!workspace || typeof name !== 'string') return
    await deleteMemory(workspace, name)
  })

  ipcMain.handle(IPC.MEMORY_INDEX, async () => {
    const workspace = getWorkspace()
    if (!workspace) return ''
    return readIndex(workspace)
  })

  ipcMain.handle(IPC.MEMORY_REBUILD, async () => {
    const workspace = getWorkspace()
    if (!workspace) return ''
    return rebuildIndex(workspace)
  })
}
