/** 展示层格式化工具（纯函数，无副作用） */

/** 取路径最后一段，兼容 Windows 反斜杠与结尾分隔符 */
export function basename(target: string): string {
  const normalized = target.replace(/[\\/]+$/, '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
}

/** 保留首尾、中间省略，用于长路径展示 */
export function shortenPath(target: string, max = 52): string {
  if (target.length <= max) return target
  const head = target.slice(0, 10)
  const tail = target.slice(-(max - 13))
  return `${head}…${tail}`
}

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / n 天前 / M月D日 */
export function formatRelativeTime(input: string | number | Date): string {
  const time =
    input instanceof Date
      ? input.getTime()
      : typeof input === 'number'
        ? input
        : Date.parse(input)

  if (!Number.isFinite(time)) return ''

  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`

  const date = new Date(time)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 紧凑数字：1234 → 1.2k，1500000 → 1.5M */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}
