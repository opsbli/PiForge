import { create } from 'zustand'
import type { MemoryEntry } from '@shared/ipc-types'

interface MemoryState {
  entries: MemoryEntry[]
  index: string
  selected: MemoryEntry | null
  search: string

  load: () => Promise<void>
  select: (name: string | null) => Promise<void>
  save: (entry: {
    name: string
    description: string
    type: string
    body: string
  }) => Promise<void>
  remove: (name: string) => Promise<void>
  setSearch: (value: string) => void
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  entries: [],
  index: '',
  selected: null,
  search: '',

  load: async () => {
    const [entries, index] = await Promise.all([
      window.piforge.listMemories(),
      window.piforge.getMemoryIndex()
    ])
    set({ entries, index })
  },

  select: async (name) => {
    if (!name) {
      set({ selected: null })
      return
    }
    const entry = await window.piforge.readMemory(name)
    set({ selected: entry })
  },

  save: async (entry) => {
    await window.piforge.writeMemory(entry)
    await get().load()
    if (get().selected?.name === entry.name) {
      set({ selected: await window.piforge.readMemory(entry.name) })
    }
  },

  remove: async (name) => {
    await window.piforge.deleteMemory(name)
    set({ selected: null })
    await get().load()
  },

  setSearch: (value) => set({ search: value })
}))
