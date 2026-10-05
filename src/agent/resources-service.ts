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

function toDiagnostics(list: RawDiagnostic[] | undefined): ResourceDiagnosticInfo[] {
  if (!Array.isArray(list)) return []
  return list.map((item) => ({
    path: item.path ?? '',
    message: item.message ?? String(item),
    // collision 归入 error 一档，避免 UI 出现第三种类别
    severity: item.type === 'warning' ? 'warning' : 'error'
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

  const extensionWarnings = toDiagnostics([
    ...(extensionsResult.errors as unknown as RawDiagnostic[]),
    ...((extensionsResult.warnings ?? []) as unknown as RawDiagnostic[])
  ])

  return {
    extensions: (extensionsResult.extensions as unknown as RawExtension[]).map(toExtensionInfo),
    extensionDiagnostics: extensionWarnings,
    skills: (skillsResult.skills as unknown as RawSkill[]).map(toSkillInfo),
    skillDiagnostics: toDiagnostics(skillsResult.diagnostics as unknown as RawDiagnostic[]),
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
