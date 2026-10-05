import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type { ProfileNicknameRequest, UserProfile } from '../../shared/ipc-types'
import { clearAvatar, getProfile, pickAvatar, setNickname } from '../profile'

/** 本机个人资料 IPC：头像 / 昵称的读写 */
export function registerProfileIpc(): void {
  ipcMain.handle(IPC.PROFILE_GET, async (): Promise<UserProfile> => getProfile())

  ipcMain.handle(
    IPC.PROFILE_SET_NICKNAME,
    async (_event, request: ProfileNicknameRequest): Promise<UserProfile> =>
      setNickname(request?.nickname ?? '')
  )

  ipcMain.handle(
    IPC.PROFILE_PICK_AVATAR,
    async (event): Promise<UserProfile | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return pickAvatar(win)
    }
  )

  ipcMain.handle(IPC.PROFILE_CLEAR_AVATAR, async (): Promise<UserProfile> => clearAvatar())
}
