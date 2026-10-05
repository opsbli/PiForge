import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { extname, join } from 'node:path'
import { userInfo } from 'node:os'
import { IPC } from '../shared/ipc-types'
import type { UserProfile } from '../shared/ipc-types'

/**
 * 本机个人资料：昵称 + 头像。
 *
 * 这是 PiForge 的界面身份，不是 pi-agent 的配置，因此持久化在 userData 下
 * （`profile.json` + `profile/avatar.bin`），不写入项目级 settings.json，
 * 避免把个人头像卷进版本库。
 *
 * 头像以 data URL 交给渲染进程直接作为 `<img src>` 使用；只接受常见图片格式并限制大小。
 */

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

interface StoredProfile {
  nickname: string | null
  avatarMime: string | null
}

const profileFile = (): string => join(app.getPath('userData'), 'profile.json')
const avatarDir = (): string => join(app.getPath('userData'), 'profile')
const avatarFile = (): string => join(avatarDir(), 'avatar.bin')

const EMPTY: StoredProfile = { nickname: null, avatarMime: null }

/** 默认昵称：系统用户名；取不到时回退「未命名用户」 */
function defaultNickname(): string {
  try {
    const name = userInfo().username?.trim()
    return name || '未命名用户'
  } catch {
    return '未命名用户'
  }
}

async function readStored(): Promise<StoredProfile> {
  try {
    const raw = JSON.parse(await fs.readFile(profileFile(), 'utf-8')) as Partial<StoredProfile>
    return {
      nickname: typeof raw.nickname === 'string' && raw.nickname.trim() ? raw.nickname : null,
      avatarMime: typeof raw.avatarMime === 'string' ? raw.avatarMime : null
    }
  } catch {
    return { ...EMPTY }
  }
}

async function writeStored(profile: StoredProfile): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(profileFile(), JSON.stringify(profile, null, 2), 'utf-8')
}

async function readAvatarDataUrl(stored: StoredProfile): Promise<string | null> {
  if (!stored.avatarMime) return null
  try {
    const buffer = await fs.readFile(avatarFile())
    return `data:${stored.avatarMime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

async function buildProfile(): Promise<UserProfile> {
  const stored = await readStored()
  return {
    nickname: stored.nickname,
    avatarDataUrl: await readAvatarDataUrl(stored),
    defaultNickname: defaultNickname()
  }
}

function broadcast(profile: UserProfile): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.PROFILE_CHANGED, profile)
  }
}

export async function getProfile(): Promise<UserProfile> {
  return buildProfile()
}

export async function setNickname(nickname: string): Promise<UserProfile> {
  const stored = await readStored()
  const trimmed = nickname.trim()
  stored.nickname = trimmed ? trimmed : null
  await writeStored(stored)
  const profile = await buildProfile()
  broadcast(profile)
  return profile
}

/** 弹出图片选择框设置头像；取消返回 null */
export async function pickAvatar(win: BrowserWindow | null): Promise<UserProfile | null> {
  const options = {
    title: '选择头像图片',
    properties: ['openFile' as const],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null

  const source = result.filePaths[0]
  const mime = MIME_BY_EXT[extname(source).toLowerCase()]
  if (!mime) throw new Error('不支持的图片格式，请选择 png / jpg / webp / gif / bmp')

  const stats = await fs.stat(source)
  if (stats.size > MAX_AVATAR_BYTES) {
    throw new Error('图片过大（>5MB），请换一张更小的图片')
  }

  await fs.mkdir(avatarDir(), { recursive: true })
  await fs.copyFile(source, avatarFile())

  const stored = await readStored()
  stored.avatarMime = mime
  await writeStored(stored)

  const profile = await buildProfile()
  broadcast(profile)
  return profile
}

export async function clearAvatar(): Promise<UserProfile> {
  const stored = await readStored()
  stored.avatarMime = null
  await writeStored(stored)
  try {
    await fs.rm(avatarFile(), { force: true })
  } catch {
    // 文件可能本就不存在；清除登记即视为成功
  }
  const profile = await buildProfile()
  broadcast(profile)
  return profile
}
