import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import { getWorkspace } from '../workspace'

/**
 * 附件选择对话框。
 *
 * 与 fs 的写操作不同：附件可以是工作区内的路径，这里只负责选择并返回绝对路径，
 * 是否可读交由 agent 自身的工作区约束决定。默认起始目录为当前工作区。
 */
export function registerDialogIpc(): void {
  ipcMain.handle(IPC.DIALOG_PICK_ATTACHMENTS, async (event, kind: unknown): Promise<string[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const isFolder = kind === 'folder'
    const options = {
      title: isFolder ? '选择文件夹' : '选择文件',
      defaultPath: getWorkspace() ?? undefined,
      properties: (isFolder
        ? ['openDirectory', 'multiSelections']
        : ['openFile', 'multiSelections']) as Array<'openFile' | 'openDirectory' | 'multiSelections'>
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    return result.filePaths
  })
}
