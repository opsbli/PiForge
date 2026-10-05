import { create } from 'zustand'
import type { ApprovalRequest } from '@shared/ipc-types'

interface ApprovalState {
  /** 当前待审批的请求（同时只处理一个） */
  pending: ApprovalRequest | null
  setPending: (request: ApprovalRequest | null) => void
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pending: null,
  setPending: (request) => set({ pending: request })
}))
