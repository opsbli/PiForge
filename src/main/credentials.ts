import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * API Key 的加密存储（Electron safeStorage）。
 *
 * 安全约束：
 *   - 绝不写入 localStorage / sessionStorage。
 *   - 密文落到 userData/credentials.bin，明文只在内存中短暂存在。
 *   - safeStorage 不可用时（如 Linux 无 keyring）回退到环境变量，不降级为明文落盘。
 */

const CREDENTIALS_FILE = 'credentials.bin'

function credentialsPath(): string {
  return join(app.getPath('userData'), CREDENTIALS_FILE)
}

/** 是否可用 safeStorage（部分 Linux 环境不可用） */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** 保存 API Key（加密落盘） */
export function saveApiKey(apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不支持 safeStorage 加密，拒绝以明文保存 API Key')
  }
  const encrypted = safeStorage.encryptString(apiKey)
  const path = credentialsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encrypted)
}

/** 读取 API Key（解密；不存在返回 null） */
export function loadApiKey(): string | null {
  const path = credentialsPath()
  if (!existsSync(path)) return null
  try {
    const encrypted = readFileSync(path)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

/** 删除已保存的 API Key */
export function clearApiKey(): void {
  const path = credentialsPath()
  if (existsSync(path)) writeFileSync(path, Buffer.alloc(0))
}

/**
 * 解析当前应使用的 API Key：
 * 优先加密存储，其次环境变量。两者都没有时返回 null。
 */
export function resolveApiKey(): string | null {
  return loadApiKey() ?? process.env.DEEPSEEK_API_KEY ?? null
}
