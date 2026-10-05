import type { PiForgeApi } from '../shared/ipc-types'

declare global {
  interface Window {
    piforge: PiForgeApi
  }
}

export {}
