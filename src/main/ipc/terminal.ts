import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import { IPC } from '../../shared/ipc-types'
import { getWorkspace } from '../workspace'

/**
 * 终端 IPC（node-pty）。
 *
 * 每个终端是一个真实 pty，cwd 限制在当前工作区。
 * 数据通过 TERMINAL_DATA 事件流回渲染进程。
 *
 * 生命周期绑定：终端归属于创建它的 webContents，窗口销毁时立即结束对应 pty。
 * 窗口销毁后 pty 仍可能推出最后一批数据（shell 收尾、kill 产生的输出），
 * 因此发送前必须检查 isDestroyed —— 长期持有 BrowserWindow 引用再读
 * `.webContents` 会直接抛 "Object has been destroyed"，可选链也拦不住。
 */

const terminals = new Map<string, pty.IPty>()
let seq = 0

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC?.toLowerCase().includes('cmd') ? 'cmd.exe' : 'powershell.exe'
  }
  return process.env.SHELL ?? '/bin/bash'
}

export function registerTerminalIpc(): void {
  ipcMain.handle(IPC.TERMINAL_CREATE, async (event, cwd?: unknown): Promise<string> => {
    const id = `term-${++seq}`
    const workspace = getWorkspace() ?? process.cwd()
    const term = pty.spawn(defaultShell(), [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: typeof cwd === 'string' && cwd ? cwd : workspace,
      env: process.env as Record<string, string>
    })
    terminals.set(id, term)

    // 用 WebContents 本身而非 BrowserWindow 引用：后者的 webContents 取值在销毁后会抛错
    const sender = event.sender
    const send = (channel: string, payload: unknown): void => {
      if (!sender.isDestroyed()) sender.send(channel, payload)
    }

    term.onData((data) => {
      send(IPC.TERMINAL_DATA, { terminalId: id, data })
    })
    term.onExit(({ exitCode }) => {
      send(IPC.TERMINAL_EXIT, { terminalId: id, exitCode })
      terminals.delete(id)
    })

    // 窗口销毁即结束该终端：此后输出已无处送达，让 shell 进程继续跑只会积累异常
    sender.once('destroyed', () => {
      const owned = terminals.get(id)
      if (!owned) return
      terminals.delete(id)
      try {
        owned.kill()
      } catch {
        // pty 已自行退出
      }
    })

    return id
  })

  ipcMain.handle(IPC.TERMINAL_INPUT, async (_event, id: unknown, data: unknown): Promise<void> => {
    terminals.get(String(id))?.write(String(data ?? ''))
  })

  ipcMain.handle(
    IPC.TERMINAL_RESIZE,
    async (_event, id: unknown, cols: unknown, rows: unknown): Promise<void> => {
      const term = terminals.get(String(id))
      if (term && typeof cols === 'number' && typeof rows === 'number') {
        term.resize(Math.max(1, cols), Math.max(1, rows))
      }
    }
  )

  ipcMain.handle(IPC.TERMINAL_KILL, async (_event, id: unknown): Promise<void> => {
    const key = String(id)
    terminals.get(key)?.kill()
    terminals.delete(key)
  })
}

/** 应用退出时清理所有终端 */
export function disposeTerminals(): void {
  for (const term of terminals.values()) {
    try {
      term.kill()
    } catch {
      // 忽略
    }
  }
  terminals.clear()
}
