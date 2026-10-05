import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ProjectTrustDefault, TrustSnapshot } from '../shared/ipc-types'

/**
 * 项目信任只读快照。
 *
 * 「受保护资源」清单来源：pi-coding-agent 的 docs/security.md
 * 「Resources protected by project trust」。这里自己探测是为了让 UI 能指出
 * **具体是哪些**资源触发了信任要求，而不是只知道一个布尔值。
 */

const PROTECTED_PROJECT_RESOURCES: ReadonlyArray<readonly string[]> = [
  ['.pi', 'settings.json'],
  ['.pi', 'mcp.json'],
  ['.pi', 'extensions'],
  ['.pi', 'skills'],
  ['.pi', 'prompts'],
  ['.pi', 'themes'],
  ['.pi', 'SYSTEM.md'],
  ['.pi', 'APPEND_SYSTEM.md']
]

/** 返回探测到的受保护项目资源（相对 cwd 的 POSIX 风格路径） */
export function probeProtectedResources(cwd: string): string[] {
  const found: string[] = []
  for (const parts of PROTECTED_PROJECT_RESOURCES) {
    if (existsSync(join(cwd, ...parts))) found.push(parts.join('/'))
  }
  return found
}

export interface TrustSnapshotInput {
  cwd: string
  /** SDK 的 hasTrustRequiringProjectResources(cwd) 结果 */
  sdkRequiresTrust: boolean
  /** ProjectTrustStore.get(cwd)；null 表示没有已保存的决定 */
  decision: boolean | null
  savedPath: string | null
  /** 当前运行中的 resourceLoader 是否按「已信任」加载 */
  loaderTrusted: boolean
  defaultProjectTrust: ProjectTrustDefault
}

export function buildTrustSnapshot(input: TrustSnapshotInput): TrustSnapshot {
  const protectedResources = probeProtectedResources(input.cwd)

  return {
    cwd: input.cwd,
    decision: input.decision,
    savedPath: input.savedPath,
    // 两方任一为真即认为需要信任决定
    requiresTrust: input.sdkRequiresTrust || protectedResources.length > 0,
    protectedResources,
    loaderTrusted: input.loaderTrusted,
    defaultProjectTrust: input.defaultProjectTrust
  }
}

export function emptyTrustSnapshot(cwd: string): TrustSnapshot {
  return {
    cwd,
    decision: null,
    savedPath: null,
    requiresTrust: false,
    protectedResources: [],
    loaderTrusted: false,
    defaultProjectTrust: 'ask'
  }
}
