import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { SettingsManager } from '@earendil-works/pi-coding-agent'
import { FIELD_SPECS } from './settings-write'
import type {
  CacheWarmingName,
  CodemodeModeName,
  FileProbe,
  ProjectTrustDefault,
  ResolvedSettings,
  SettingsPaths,
  SettingsSnapshot,
  ThinkingLevelName,
  TransportName
} from '../shared/ipc-types'

/**
 * 设置只读快照。
 *
 * 注意：本模块**不能静态导入 SDK 运行时**——`@earendil-works/pi-coding-agent` 是纯 ESM，
 * 而 agent Utility Process 被构建为 CJS。因此这里只接收调用方已经构造好的
 * SettingsManager 实例（`import type` 会被编译期擦除，是安全的）。
 */

/** 探测文件/目录是否存在及体积（不读取内容） */
export function probePath(target: string): FileProbe {
  try {
    const info = statSync(target)
    const isDirectory = info.isDirectory()
    return {
      path: target,
      exists: true,
      isDirectory,
      bytes: isDirectory ? null : info.size
    }
  } catch {
    return { path: target, exists: false, isDirectory: false, bytes: null }
  }
}

export function settingsPaths(cwd: string, agentDir: string): SettingsPaths {
  return {
    agentDir,
    cwd,
    globalSettings: join(agentDir, 'settings.json'),
    projectSettings: join(cwd, '.pi', 'settings.json'),
    globalMcp: join(agentDir, 'mcp.json'),
    projectMcp: join(cwd, '.pi', 'mcp.json'),
    trustFile: join(agentDir, 'trust.json'),
    authFile: join(agentDir, 'auth.json')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** 按点分路径读取嵌套值 */
function readPath(source: Record<string, unknown>, key: string): unknown {
  let cursor: unknown = source
  for (const part of key.split('.')) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

/** 按字段规格生成生效值：显式配置优先，否则取规格里的内置默认 */
function buildResolvedValues(effective: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const spec of FIELD_SPECS) {
    values[spec.key] = readPath(effective, spec.key) ?? spec.defaultValue ?? null
  }
  return values
}

/** PackageSource 可能是字符串或对象形式，统一取来源字符串 */
function describePackageSource(source: unknown): string {
  if (typeof source === 'string') return source
  if (source && typeof source === 'object') {
    const inner = (source as { source?: unknown }).source
    if (typeof inner === 'string') return inner
  }
  return String(source)
}

function buildResolved(settings: SettingsManager): ResolvedSettings {
  const explicit = asRecord(settings.getSettings())
  const codemode = asRecord(explicit.codemode)
  const retry = settings.getRetrySettings()
  const branchSummary = settings.getBranchSummarySettings()
  const compaction = settings.getCompactionSettings()

  return {
    // 模型
    defaultProvider: settings.getDefaultProvider() ?? null,
    defaultModel: settings.getDefaultModel() ?? null,
    defaultThinkingLevel: (settings.getDefaultThinkingLevel() ??
      'medium') as ThinkingLevelName,
    modelThinkingLevels: (settings.getAllModelThinkingLevels() ??
      {}) as Record<string, ThinkingLevelName>,
    enabledModels: settings.getEnabledModels() ?? null,
    hideThinkingBlock: settings.getHideThinkingBlock(),
    cacheWarming: settings.getCacheWarmingMode() as CacheWarmingName,
    // 工具
    defaultTools: settings.getDefaultTools() ?? null,
    codemodeMode: (codemode.mode as CodemodeModeName | undefined) ?? null,
    codemodeInlineBudget:
      typeof codemode.inlineBudget === 'number' ? codemode.inlineBudget : null,
    // 会话与上下文
    compactionEnabled: compaction.enabled,
    compactionReserveTokens: compaction.reserveTokens,
    compactionKeepRecentTokens: compaction.keepRecentTokens,
    branchSummaryReserveTokens: branchSummary.reserveTokens,
    branchSummarySkipPrompt: branchSummary.skipPrompt,
    sessionDir: settings.getSessionDir() ?? null,
    transport: settings.getTransport() as TransportName,
    httpProxy:
      typeof explicit.httpProxy === 'string' ? explicit.httpProxy : null,
    httpIdleTimeoutMs: settings.getHttpIdleTimeoutMs(),
    retryEnabled: retry.enabled,
    retryMaxRetries: retry.maxRetries,
    retryBaseDelayMs: retry.baseDelayMs,
    steeringMode: settings.getSteeringMode(),
    followUpMode: settings.getFollowUpMode(),
    // 资源
    packages: settings.getPackages().map(describePackageSource),
    extensionPaths: settings.getExtensionPaths(),
    skillPaths: settings.getSkillPaths(),
    promptTemplatePaths: settings.getPromptTemplatePaths(),
    themePaths: settings.getThemePaths(),
    enableSkillCommands: settings.getEnableSkillCommands(),
    // 信任
    defaultProjectTrust: settings.getDefaultProjectTrust() as ProjectTrustDefault,
    // 其他
    shellPath: settings.getShellPath() ?? null,
    shellCommandPrefix: settings.getShellCommandPrefix() ?? null,
    npmCommand: settings.getNpmCommand() ?? null,
    enableInstallTelemetry: settings.getEnableInstallTelemetry(),
    enableAnalytics: settings.getEnableAnalytics(),
    imageAutoResize: settings.getImageAutoResize(),
    blockImages: settings.getBlockImages()
  }
}

/**
 * 组装设置快照。
 *
 * `drainErrors()` 是消费式的：错误只会被报告一次。P1 只有读取，不存在与写入争抢；
 * P2 引入写入后需要重新评估是否改为不消费的方式。
 */
export function buildSettingsSnapshot(
  settings: SettingsManager,
  cwd: string,
  agentDir: string,
  versions: { sdk: string | null } = { sdk: null }
): SettingsSnapshot {
  const paths = settingsPaths(cwd, agentDir)
  const globalRaw = asRecord(settings.getGlobalSettings())
  const projectRaw = asRecord(settings.getProjectSettings())

  const errors = settings
    .drainErrors()
    .map((entry) => ({
      scope: entry.scope,
      message: entry.error?.message ?? String(entry.error)
    }))

  return {
    paths,
    versions,
    global: globalRaw,
    project: projectRaw,
    effective: asRecord(settings.getSettings()),
    resolved: buildResolved(settings),
    projectTrusted: settings.isProjectTrusted(),
    errors,
    // 只探测存在性与体积，绝不把 auth.json 等内容送进渲染进程
    files: [
      probePath(paths.globalSettings),
      probePath(paths.projectSettings),
      probePath(paths.globalMcp),
      probePath(paths.projectMcp),
      probePath(paths.trustFile),
      probePath(paths.authFile),
      probePath(paths.agentDir)
    ],
    fields: FIELD_SPECS,
    resolvedValues: buildResolvedValues(asRecord(settings.getSettings()))
  }
}

/** settingsManager 尚未就绪时的占位快照 */
export function emptySettingsSnapshot(cwd: string, agentDir: string): SettingsSnapshot {
  return {
    paths: settingsPaths(cwd, agentDir),
    versions: { sdk: null },
    global: {},
    project: {},
    effective: {},
    resolved: {
      defaultProvider: null,
      defaultModel: null,
      defaultThinkingLevel: 'medium',
      modelThinkingLevels: {},
      enabledModels: null,
      hideThinkingBlock: false,
      cacheWarming: 'streaming',
      defaultTools: null,
      codemodeMode: null,
      codemodeInlineBudget: null,
      compactionEnabled: true,
      compactionReserveTokens: 0,
      compactionKeepRecentTokens: 0,
      branchSummaryReserveTokens: 0,
      branchSummarySkipPrompt: false,
      sessionDir: null,
      transport: 'auto',
      httpProxy: null,
      httpIdleTimeoutMs: 0,
      retryEnabled: true,
      retryMaxRetries: 0,
      retryBaseDelayMs: 0,
      steeringMode: 'one-at-a-time',
      followUpMode: 'one-at-a-time',
      packages: [],
      extensionPaths: [],
      skillPaths: [],
      promptTemplatePaths: [],
      themePaths: [],
      enableSkillCommands: true,
      defaultProjectTrust: 'ask',
      shellPath: null,
      shellCommandPrefix: null,
      npmCommand: null,
      enableInstallTelemetry: true,
      enableAnalytics: false,
      imageAutoResize: true,
      blockImages: false
    },
    projectTrusted: false,
    errors: [{ scope: 'global', message: '设置管理器尚未就绪（agent 仍在启动）' }],
    files: [],
    fields: FIELD_SPECS,
    resolvedValues: {}
  }
}
