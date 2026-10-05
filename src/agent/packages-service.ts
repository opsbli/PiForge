import type { PackageManager } from '@earendil-works/pi-coding-agent'
import type { PackageInfo, PackageProgress } from '../shared/ipc-types'

/**
 * Pi packages 的读取与动作封装。
 *
 * 不静态导入 SDK（纯 ESM 与 CJS 构建不兼容），只接收 agent 进程构造好的
 * DefaultPackageManager 实例。
 *
 * 注意：install / remove / update 会**真实执行 npm 或 git**，并会写入
 * settings.json。调用方必须先取得用户确认。
 */

export function listPackages(manager: PackageManager): PackageInfo[] {
  return manager.listConfiguredPackages().map((entry) => ({
    source: entry.source,
    scope: entry.scope,
    filtered: entry.filtered,
    installedPath: entry.installedPath ?? null
  }))
}

/** 把 SDK 的 ProgressEvent 映射成跨进程可序列化的形状 */
export function toPackageProgress(event: {
  type: PackageProgress['type']
  action: PackageProgress['action']
  source: string
  message?: string
}): PackageProgress {
  return {
    type: event.type,
    action: event.action,
    source: event.source,
    message: event.message ?? null
  }
}
