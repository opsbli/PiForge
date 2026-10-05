import { create } from 'zustand'
import type { CustomProvider, ProviderTemplate, SaveProviderRequest } from '@shared/ipc-types'

/** 自定义 provider / 模型配置（自定义 endpoint 与 models.json 接入） */
interface CustomProvidersState {
  providers: CustomProvider[]
  templates: ProviderTemplate[]
  loading: boolean

  load: () => Promise<void>
  loadTemplates: () => Promise<void>
  save: (request: SaveProviderRequest) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCustomProvidersStore = create<CustomProvidersState>((set) => ({
  providers: [],
  templates: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ providers: await window.piforge.listCustomProviders() })
    } finally {
      set({ loading: false })
    }
  },

  loadTemplates: async () => {
    const templates = await window.piforge.listProviderTemplates()
    set({ templates: templates ?? [] })
  },

  save: async (request) => {
    set({ providers: await window.piforge.saveCustomProvider(request) })
  },

  remove: async (id) => {
    set({ providers: await window.piforge.deleteCustomProvider(id) })
  }
}))
