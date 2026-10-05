import { create } from 'zustand'
import type { ApprovalMode, ContextUsageView, ModelListItem, SessionMeta } from '@shared/ipc-types'
import { basenameOf, type ComposerReference } from '@renderer/lib/composer-references'

/**
 * 输入框工具栏状态。
 *
 * 审批模式与思考档位是界面偏好，持久化到 localStorage；模型、上下文用量、思考档位
 * 以 agent 会话为准（refreshMeta 拉取）。引用（文件 / Skill / MCP / 会话）以 chip 形式
 * 显示在输入框内部，随下一条消息一起发出。
 */

const STORAGE_KEY = 'piforge.composer'

export const THINKING_LABELS: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '极高',
  max: '最大'
}

export function thinkingLabel(level: string): string {
  return THINKING_LABELS[level] ?? level
}

interface PersistedComposer {
  approvalMode: ApprovalMode
  thinkingLevel: string
}

function readPersisted(): Partial<PersistedComposer> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Partial<PersistedComposer> = {}
    if (parsed.approvalMode === 'auto' || parsed.approvalMode === 'ask') {
      result.approvalMode = parsed.approvalMode
    }
    if (typeof parsed.thinkingLevel === 'string') result.thinkingLevel = parsed.thinkingLevel
    return result
  } catch {
    return {}
  }
}

function persist(state: Pick<ComposerState, 'approvalMode' | 'thinkingLevel'>): void {
  try {
    const payload: PersistedComposer = {
      approvalMode: state.approvalMode,
      thinkingLevel: state.thinkingLevel
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 持久化失败只影响下次启动，不报错
  }
}

interface ComposerState {
  approvalMode: ApprovalMode
  thinkingLevel: string
  availableThinkingLevels: string[]
  providerId: string
  modelId: string
  models: ModelListItem[]
  contextUsage: ContextUsageView | null
  /** 待随下一条消息发出的引用（文件 / Skill / MCP / 会话） */
  references: ComposerReference[]

  load: () => Promise<void>
  refreshMeta: () => Promise<void>
  applyMeta: (meta: SessionMeta) => void
  toggleApprovalMode: () => Promise<void>
  setThinkingLevel: (level: string) => Promise<void>
  loadModels: () => Promise<void>
  setModel: (providerId: string, modelId: string) => Promise<void>
  addAttachments: (kind: 'file' | 'folder') => Promise<void>
  /** 添加引用（@ 文件 / / Skill / # MCP / & 会话） */
  addReferences: (references: ComposerReference[]) => void
  removeReference: (id: string) => void
  clearReferences: () => void
}

let subscribed = false

export const useComposerStore = create<ComposerState>((set, get) => ({
  approvalMode: 'ask',
  thinkingLevel: '',
  availableThinkingLevels: [],
  providerId: '',
  modelId: '',
  models: [],
  contextUsage: null,
  references: [],

  load: async () => {
    if (!subscribed) {
      subscribed = true
      // 每轮结束刷新上下文用量
      window.piforge.onAgentEvent((event) => {
        if (event.type === 'turn_end' || event.type === 'error') void get().refreshMeta()
      })
    }

    const persisted = readPersisted()
    set({
      approvalMode: persisted.approvalMode ?? 'ask',
      thinkingLevel: persisted.thinkingLevel ?? ''
    })

    await window.piforge.waitAgentReady()
    await window.piforge.setApprovalMode(get().approvalMode)
    await get().refreshMeta()

    // 恢复上次思考档位（仅当该模型支持该档位）
    const wanted = get().thinkingLevel
    if (wanted && get().availableThinkingLevels.includes(wanted)) {
      await window.piforge.setThinkingLevel(wanted)
      await get().refreshMeta()
    }

    await get().loadModels()
  },

  refreshMeta: async () => {
    const meta = await window.piforge.getSessionMeta()
    if (meta) get().applyMeta(meta)
  },

  applyMeta: (meta) =>
    set({
      providerId: meta.providerId,
      modelId: meta.modelId,
      thinkingLevel: meta.thinkingLevel || get().thinkingLevel,
      availableThinkingLevels: meta.availableThinkingLevels,
      contextUsage: meta.contextUsage
    }),

  toggleApprovalMode: async () => {
    const next: ApprovalMode = get().approvalMode === 'auto' ? 'ask' : 'auto'
    set({ approvalMode: next })
    persist(get())
    await window.piforge.setApprovalMode(next)
  },

  setThinkingLevel: async (level) => {
    set({ thinkingLevel: level })
    persist(get())
    await window.piforge.setThinkingLevel(level)
    await get().refreshMeta()
  },

  loadModels: async () => {
    const result = await window.piforge.listModels()
    if (!result) return
    set({
      models: result.models,
      providerId: result.current.providerId,
      modelId: result.current.modelId
    })
  },

  setModel: async (providerId, modelId) => {
    await window.piforge.setModel({ providerId, modelId })
    await get().loadModels()
    await get().refreshMeta()
  },

  addAttachments: async (kind) => {
    const picked = await window.piforge.pickAttachments(kind)
    if (picked.length === 0) return
    get().addReferences(
      picked.map((path) => ({
        id: `@${path}`,
        kind: '@' as const,
        label: basenameOf(path),
        value: path,
        title: path
      }))
    )
  },

  addReferences: (references) =>
    set((state) => {
      const existing = new Set(state.references.map((item) => item.id))
      const next = references.filter((item) => item.id && !existing.has(item.id))
      return next.length === 0 ? state : { references: [...state.references, ...next] }
    }),

  removeReference: (id) =>
    set((state) => ({ references: state.references.filter((item) => item.id !== id) })),

  clearReferences: () => set({ references: [] })
}))

/** 当前模型的展示名：provider 展示名 + 模型名（优先取清单里的值） */
export function modelLabelOf(state: Pick<ComposerState, 'models' | 'providerId' | 'modelId'>): string {
  const found = state.models.find(
    (model) => model.providerId === state.providerId && model.id === state.modelId
  )
  const modelName = found?.name ?? state.modelId
  const providerName = found?.providerName ?? state.providerId
  return providerName ? `${providerName} · ${modelName}` : modelName || '未选择模型'
}
