import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

/**
 * 自动更新（electron-updater + GitHub Releases）。
 *
 * 只在打包后运行（dev 模式跳过，避免误触发）。
 * 流程：检查更新 → 通知渲染进程 → 用户确认 → 下载 → 提示重启安装。
 */

export const UPDATER_CHANNELS = {
  STATUS: 'updater:status',
  CHECK: 'updater:check',
  DOWNLOAD: 'updater:download',
  INSTALL: 'updater:install'
} as const

export interface UpdaterStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  version?: string
  percent?: number
  message?: string
}

function broadcast(status: UpdaterStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(UPDATER_CHANNELS.STATUS, status)
  }
}

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    broadcast({ state: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => broadcast({ state: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    broadcast({ state: 'downloading', percent: progress.percent })
  )
  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) =>
    broadcast({ state: 'error', message: err?.message ?? String(err) })
  )

  ipcMain.handle(UPDATER_CHANNELS.CHECK, async (): Promise<UpdaterStatus> => {
    if (!app.isPackaged) return { state: 'idle', message: 'dev 模式跳过更新检查' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { state: 'checking', version: result?.updateInfo?.version }
    } catch (err) {
      return { state: 'error', message: String(err) }
    }
  })

  ipcMain.handle(UPDATER_CHANNELS.DOWNLOAD, async (): Promise<void> => {
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle(UPDATER_CHANNELS.INSTALL, async (): Promise<void> => {
    autoUpdater.quitAndInstall()
  })

  // 启动后延迟检查（仅打包环境）
  if (app.isPackaged) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch(() => undefined)
    }, 5000)
  }
}
