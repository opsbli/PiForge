import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import { getWorkspace } from '../workspace'
import { detectDocker, getStatus, setMode, stopContainer, type SandboxMode } from '../sandbox'

/**
 * 沙箱 IPC：检测 Docker / 查询状态 / 切换模式。
 */
export function registerSandboxIpc(): void {
  ipcMain.handle(IPC.SANDBOX_STATUS, async () => {
    return getStatus()
  })

  ipcMain.handle(IPC.SANDBOX_DETECT, async () => {
    return detectDocker()
  })

  ipcMain.handle(IPC.SANDBOX_SET_MODE, async (_event, mode: unknown) => {
    const workspace = getWorkspace()
    if (!workspace) throw new Error('尚未选择工作区')
    const target: SandboxMode = mode === 'docker' ? 'docker' : 'local'
    return setMode(target, workspace)
  })

  ipcMain.handle(IPC.SANDBOX_STOP, async () => {
    await stopContainer()
    return getStatus()
  })
}
