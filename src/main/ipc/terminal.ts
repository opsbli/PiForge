import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { IPC } from '../../shared/ipc-types'
import { getWorkspace } from '../workspace'

/**
 * 终端 IPC（node-pty）。
 *
 * 每个终端是一个真实 pty，cwd 限制在当前工作区。
 * 数据通过 TERMINAL_DATA 事件流回渲染进程。
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

    const win = BrowserWindow.fromWebContents(event.sender)
    term.onData((data) => {
      win?.webContents.send(IPC.TERMINAL_DATA, { terminalId: id, data })
    })
    term.onExit(({ exitCode }) => {
      win?.webContents.send(IPC.TERMINAL_EXIT, { terminalId: id, exitCode })
      terminals.delete(id)
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
