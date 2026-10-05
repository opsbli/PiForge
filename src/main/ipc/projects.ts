import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type {
  ProjectCreateBlankRequest,
  ProjectIdRequest,
  ProjectRenameRequest,
  ProjectState
} from '../../shared/ipc-types'
import {
  activateProject,
  createBlankProject,
  createProjectFromFolder,
  getProjectState,
  removeProject,
  renameProject
} from '../projects'

/** 项目管理 IPC：所有变更回到主进程的注册表，再广播给窗口 */
export function registerProjectIpc(): void {
  ipcMain.handle(IPC.PROJECT_STATE, async (): Promise<ProjectState> => getProjectState())

  ipcMain.handle(
    IPC.PROJECT_CREATE_FOLDER,
    async (event): Promise<ProjectState | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return createProjectFromFolder(win)
    }
  )

  ipcMain.handle(
    IPC.PROJECT_CREATE_BLANK,
    async (_event, request: ProjectCreateBlankRequest | undefined): Promise<ProjectState> =>
      createBlankProject(request?.name)
  )

  ipcMain.handle(
    IPC.PROJECT_RENAME,
    async (_event, request: ProjectRenameRequest): Promise<ProjectState> =>
      renameProject(request.id, request.name)
  )

  ipcMain.handle(IPC.PROJECT_REMOVE, async (_event, request: ProjectIdRequest): Promise<ProjectState> =>
    removeProject(request.id)
  )

  ipcMain.handle(
    IPC.PROJECT_ACTIVATE,
    async (_event, request: ProjectIdRequest): Promise<ProjectState> => activateProject(request.id)
  )
}
