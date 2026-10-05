import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import {
  registerAgentIpc,
  registerSettingsIpc,
  registerFsIpc,
  registerTerminalIpc,
  registerMemoryIpc,
  registerSandboxIpc,
  registerTraceIpc,
  registerWindowIpc,
  disposeTerminals
} from './ipc'
import { agentHost } from './agent-host'
import { setWorkspace } from './workspace'
import { stopContainer } from './sandbox'
import { openTraceStore, closeTraceStore } from './trace-store'
import { setupAutoUpdater } from './updater'
import { IPC } from '../shared/ipc-types'

/** 与默认暗色主题一致的窗口底色，避免加载首帧白闪 */
const WINDOW_BACKGROUND = '#0a0a0a'

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: WINDOW_BACKGROUND,
    // 自定义标题栏：Windows/Linux 去掉系统边框，macOS 保留内缩的交通灯
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const } : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 安全配置（缺一不可）：渲染进程与 Node 完全隔离
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // 最大化状态同步给标题栏（图标切换 + 双击标题栏行为）
  const emitMaximizeState = (): void => {
    if (win.isDestroyed()) return
    win.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGED, win.isMaximized())
  }
  win.on('maximize', emitMaximizeState)
  win.on('unmaximize', emitMaximizeState)

  // electron-vite 在 dev 下注入 ELECTRON_RENDERER_URL
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerAgentIpc()
  registerSettingsIpc()
  registerFsIpc()
  registerTerminalIpc()
  registerMemoryIpc()
  registerSandboxIpc()
  registerTraceIpc()
  registerWindowIpc()
  setupAutoUpdater()
  // 启动时默认把当前目录作为工作区（用户可随时用「打开文件夹」切换）
  setWorkspace(process.env.PIFORGE_WORKSPACE ?? process.cwd())
  openTraceStore()
  agentHost.start(process.env.PIFORGE_WORKSPACE ?? process.cwd())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  disposeTerminals()
  // 退出时清理沙箱容器（避免残留）
  void stopContainer().catch(() => undefined)
  agentHost.dispose()
  closeTraceStore()
})
