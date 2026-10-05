import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * JSON 配置文件的原子读写。
 *
 * 设计约束（与 settings-write 一致，因此抽出来共用）：
 * - 现有文件存在但**无法解析时拒绝写入**，绝不覆盖用户内容
 * - 写前备份 `.bak`，再用同目录临时文件 + rename 原子替换，避免留下半截文件
 * - 沿用原文件缩进，避免整文件重排
 */

export interface JsonReadResult {
  exists: boolean
  text: string
  /** 解析失败时为 null */
  value: Record<string, unknown> | null
  error?: string
}

export function readJsonFile(filePath: string): JsonReadResult {
  if (!existsSync(filePath)) return { exists: false, text: '', value: {} }

  const text = readFileSync(filePath, 'utf8')
  if (!text.trim()) return { exists: true, text, value: {} }

  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { exists: true, text, value: null, error: '顶层不是 JSON 对象' }
    }
    return { exists: true, text, value: parsed as Record<string, unknown> }
  } catch (error) {
    return { exists: true, text, value: null, error: String(error) }
  }
}

/** 沿用原文件的缩进，避免整文件重排 */
export function detectIndent(text: string): string | number {
  const match = text.match(/\n([ \t]+)"/)
  if (!match) return 2
  return match[1].includes('\t') ? '\t' : match[1].length
}

export interface JsonWriteResult {
  ok: boolean
  error?: string
}

export function writeJsonFile(input: {
  filePath: string
  value: unknown
  indent: string | number
  existed: boolean
}): JsonWriteResult {
  const serialized = `${JSON.stringify(input.value, null, input.indent)}\n`

  try {
    mkdirSync(dirname(input.filePath), { recursive: true })
    if (input.existed) copyFileSync(input.filePath, `${input.filePath}.bak`)
    const temporary = `${input.filePath}.tmp-${process.pid}`
    writeFileSync(temporary, serialized, 'utf8')
    renameSync(temporary, input.filePath)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: `写入失败：${String(error)}` }
  }
}
