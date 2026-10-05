import { basename } from 'node:path'
import type { ResourceLoader } from '@earendil-works/pi-coding-agent'
import type {
  ExtensionInfo,
  ResourceDiagnosticInfo,
  ResourcesSnapshot,
  SkillInfo,
  ToolInfoLite
} from '../shared/ipc-types'

/**
 * 已加载资源只读快照（扩展 / skill / 上下文文件 / 诊断）。
 *
 * 与 settings-service 同理：本模块不静态导入 SDK 运行时，只接收调用方构造好的
 * ResourceLoader 实例。SDK 的具体类型在此用宽松结构描述，避免把 SDK 类型
 * 泄漏到跨进程契约里。
 */

interface RawExtension {
  path: string
  resolvedPath?: string
  hidden?: boolean
  sourceInfo?: { source?: string; scope?: string; origin?: string }
  tools?: { size: number }
  commands?: { size: number }
}

interface RawSkill {
  name: string
  description?: string
  filePath?: string
  baseDir?: string
  sourceInfo?: { source?: string; scope?: string }
  disableModelInvocation?: boolean
}

interface RawDiagnostic {
  type?: string
  message?: string
  /** 扩展加载错误的字段名（LoadExtensionsResult.errors） */
  error?: string
  /** 扩展加载告警的字段名（LoadExtensionsResult.warnings） */
  warning?: string
  path?: string
}

const BUILTIN_PREFIX = 'builtin:'

function toExtensionInfo(extension: RawExtension): ExtensionInfo {
  const rawPath = extension.path ?? ''
  const builtin = rawPath.startsWith(BUILTIN_PREFIX)
  const resolved = extension.resolvedPath || rawPath

  return {
    name: builtin ? rawPath : basename(resolved) || rawPath,
    path: resolved,
    source: extension.sourceInfo?.source ?? '',
    scope: String(extension.sourceInfo?.scope ?? ''),
    builtin,
    toolCount: extension.tools?.size ?? 0,
    commandCount: extension.commands?.size ?? 0
  }
}

/**
 * 诊断信息映射。
 *
 * SDK 有三套字段名：`ResourceDiagnostic.message`（skill / prompt / theme）、
 * `LoadExtensionsResult.errors[].error`、`LoadExtensionsResult.warnings[].warning`。
 * 只读 `message` 会把扩展加载失败的原因渲染成 `[object Object]`，恰好丢掉最需要的
 * 信息，因此逐个兼容；严重级别无法从条目自身判断时由调用方传入
 * （warnings 数组里的项没有 type 字段，默认判为 error 是错的）。
 */
function toDiagnostics(
  list: RawDiagnostic[] | undefined,
  defaultSeverity: ResourceDiagnosticInfo['severity']
): ResourceDiagnosticInfo[] {
  if (!Array.isArray(list)) return []

  return list.map((item) => ({
    path: item.path ?? '',
    message: item.message ?? item.error ?? item.warning ?? JSON.stringify(item),
    severity:
      item.type === 'warning'
        ? 'warning'
        : item.type === 'error' || item.type === 'collision'
          ? 'error'
          : defaultSeverity
  }))
}

function toSkillInfo(skill: RawSkill): SkillInfo {
  return {
    name: skill.name,
    description: skill.description ?? '',
    filePath: skill.filePath ?? '',
    baseDir: skill.baseDir ?? '',
    source: skill.sourceInfo?.source ?? '',
    scope: String(skill.sourceInfo?.scope ?? ''),
    disableModelInvocation: Boolean(skill.disableModelInvocation)
  }
}

export function buildResourcesSnapshot(
  loader: ResourceLoader | null,
  tools: ToolInfoLite[] = []
): ResourcesSnapshot {
  if (!loader) return emptyResourcesSnapshot()

  const extensionsResult = loader.getExtensions()
  const skillsResult = loader.getSkills()
  const promptsResult = loader.getPrompts()
  const themesResult = loader.getThemes()
  const agentsFilesResult = loader.getAgentsFiles()

  const extensionDiagnostics = [
    ...toDiagnostics(extensionsResult.errors as unknown as RawDiagnostic[], 'error'),
    ...toDiagnostics((extensionsResult.warnings ?? []) as unknown as RawDiagnostic[], 'warning')
  ]

  return {
    extensions: (extensionsResult.extensions as unknown as RawExtension[]).map(toExtensionInfo),
    extensionDiagnostics,
    skills: (skillsResult.skills as unknown as RawSkill[]).map(toSkillInfo),
    skillDiagnostics: toDiagnostics(skillsResult.diagnostics as unknown as RawDiagnostic[], 'error'),
    counts: {
      skills: skillsResult.skills.length,
      prompts: promptsResult.prompts.length,
      themes: themesResult.themes.length
    },
    contextFiles: agentsFilesResult.agentsFiles.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.content, 'utf8')
    })),
    systemPromptSource: loader.getSystemPromptSource()?.path ?? null,
    appendSystemPromptSources: loader
      .getAppendSystemPromptSources()
      .map((source) => source.path),
    tools
  }
}

export function emptyResourcesSnapshot(): ResourcesSnapshot {
  return {
    extensions: [],
    extensionDiagnostics: [],
    skills: [],
    skillDiagnostics: [],
    counts: { skills: 0, prompts: 0, themes: 0 },
    contextFiles: [],
    systemPromptSource: null,
    appendSystemPromptSources: [],
    tools: []
  }
}
