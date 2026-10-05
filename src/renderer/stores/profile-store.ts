import { create } from 'zustand'
import type { UserProfile } from '@shared/ipc-types'

/**
 * 本机个人资料（头像 / 昵称）。
 *
 * 昵称与头像持久化在主进程 userData 下；未设置时用 `defaultNickname`（系统用户名）
 * 与内置默认头像，二者均由展示层兜底。
 */
interface ProfileState {
  nickname: string | null
  avatarDataUrl: string | null
  defaultNickname: string
  loaded: boolean

  load: () => Promise<void>
  setNickname: (name: string) => Promise<void>
  pickAvatar: () => Promise<void>
  clearAvatar: () => Promise<void>
  apply: (profile: UserProfile) => void
}

let subscribed = false

export const useProfileStore = create<ProfileState>((set, get) => ({
  nickname: null,
  avatarDataUrl: null,
  defaultNickname: '未命名用户',
  loaded: false,

  load: async () => {
    if (!subscribed) {
      subscribed = true
      window.piforge.onProfileChanged((profile) => get().apply(profile))
    }
    get().apply(await window.piforge.getProfile())
    set({ loaded: true })
  },

  setNickname: async (name) => {
    get().apply(await window.piforge.setNickname({ nickname: name }))
  },

  pickAvatar: async () => {
    try {
      const profile = await window.piforge.pickAvatar()
      if (profile) get().apply(profile)
    } catch (error) {
      window.alert(`设置头像失败：${String(error)}`)
    }
  },

  clearAvatar: async () => {
    get().apply(await window.piforge.clearAvatar())
  },

  apply: (profile) =>
    set({
      nickname: profile.nickname,
      avatarDataUrl: profile.avatarDataUrl,
      defaultNickname: profile.defaultNickname
    })
}))
