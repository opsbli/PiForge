/** 按点分路径读取嵌套值；与 agent 侧的同名工具保持一致语义 */
export function readSettingsPath(
  source: Record<string, unknown> | null | undefined,
  key: string
): unknown {
  if (!source) return undefined
  let cursor: unknown = source
  for (const part of key.split('.')) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}
