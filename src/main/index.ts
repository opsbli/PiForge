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
  registerProjectIpc,
  registerProfileIpc,
  disposeTerminals
} from './ipc'
import { agentHost } from './agent-host'
import { initProjects } from './projects'
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

app.whenReady().then(async () => {
  registerAgentIpc()
  registerSettingsIpc()
  registerFsIpc()
  registerTerminalIpc()
  registerMemoryIpc()
  registerSandboxIpc()
  registerTraceIpc()
  registerWindowIpc()
  registerProjectIpc()
  registerProfileIpc()
  setupAutoUpdater()
  openTraceStore()
  // 初始化多项目注册表：首个项目默认取当前目录（可用 PIFORGE_WORKSPACE 覆盖）
  const activePath = await initProjects(process.env.PIFORGE_WORKSPACE ?? process.cwd())
  agentHost.start(activePath)
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
