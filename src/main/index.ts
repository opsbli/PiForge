import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerAgentIpc } from './ipc'
import { agentHost } from './agent-host'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 安全配置（缺一不可）：渲染进程与 Node 完全隔离
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // electron-vite 在 dev 下注入 ELECTRON_RENDERER_URL
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerAgentIpc()
  // 启动 Agent Utility Process（阶段五会把 workspace 改为用户授权的工作区）
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
  agentHost.dispose()
})
