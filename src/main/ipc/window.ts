import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc-types'

/** 从 IPC 事件定位发起方窗口，避免多窗口时操作到错误的窗口 */
function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

/**
 * 自定义标题栏所需的窗口控制 IPC。
 *
 * 安全边界：这里只做窗口状态控制，不涉及文件系统、Shell 或 Node 能力，
 * 也不改动 BrowserWindow 的 webPreferences（contextIsolation / sandbox / nodeIntegration 保持原值）。
 * 最大化状态变更由 main/index.ts 在窗口事件里广播给渲染进程。
 */
export function registerWindowIpc(): void {
  ipcMain.handle(IPC.WINDOW_MINIMIZE, (event): void => {
    windowFromEvent(event)?.minimize()
  })

  ipcMain.handle(IPC.WINDOW_TOGGLE_MAXIMIZE, (event): boolean => {
    const win = windowFromEvent(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle(IPC.WINDOW_CLOSE, (event): void => {
    windowFromEvent(event)?.close()
  })

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, (event): boolean => {
    return windowFromEvent(event)?.isMaximized() ?? false
  })
}
