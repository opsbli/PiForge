import { create } from 'zustand'
import type { CustomProvider, SaveProviderRequest } from '@shared/ipc-types'

/** 自定义 provider / 模型配置（自定义 endpoint 与 models.json 接入） */
interface CustomProvidersState {
  providers: CustomProvider[]
  loading: boolean

  load: () => Promise<void>
  save: (request: SaveProviderRequest) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCustomProvidersStore = create<CustomProvidersState>((set) => ({
  providers: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ providers: await window.piforge.listCustomProviders() })
    } finally {
      set({ loading: false })
    }
  },

  save: async (request) => {
    set({ providers: await window.piforge.saveCustomProvider(request) })
  },

  remove: async (id) => {
    set({ providers: await window.piforge.deleteCustomProvider(id) })
  }
}))
