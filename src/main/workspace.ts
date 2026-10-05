import { dialog, BrowserWindow } from 'electron'
import { resolve } from 'node:path'

/**
 * 工作区管理：Agent 与文件操作只能访问用户授权的工作区。
 * 阶段六加「打开文件夹」对话框选定。
 */

let currentWorkspace: string | null = null

export function getWorkspace(): string | null {
  return currentWorkspace
}

export function setWorkspace(path: string): string {
  currentWorkspace = resolve(path)
  return currentWorkspace
}

/** 弹出系统「打开文件夹」对话框，返回选定的绝对路径（取消返回 null） */
export async function selectWorkspace(win: BrowserWindow | null): Promise<string | null> {
  const options = {
    title: '选择工作区',
    properties: ['openDirectory' as const, 'createDirectory' as const]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return setWorkspace(result.filePaths[0])
}
