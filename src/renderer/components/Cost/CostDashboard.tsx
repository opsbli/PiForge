import type { JSX } from 'react'
import { useEffect } from 'react'
import { useCostStore } from '@renderer/stores/cost-store'

/** 成本状态栏：token / 费用 / 缓存命中 */
export function CostDashboard(): JSX.Element {
  const summary = useCostStore((s) => s.summary)
  const refreshSummary = useCostStore((s) => s.refreshSummary)

  // 首次拉取 + 每 5 秒轮询
  useEffect(() => {
    void refreshSummary()
    const timer = window.setInterval(() => void refreshSummary(), 5000)
    return () => window.clearInterval(timer)
  }, [refreshSummary])

  const t = summary?.tokenUsage
  const cacheTotal = (t?.cacheRead ?? 0) + (t?.cacheWrite ?? 0)
  const inputTotal = (t?.input ?? 0) + cacheTotal
  const hitRate = inputTotal > 0 ? (t?.cacheRead ?? 0) / inputTotal : 0

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span title="输入 token（含缓存）">↓ {fmt(t?.input ?? 0)}</span>
      <span title="输出 token">↑ {fmt(t?.output ?? 0)}</span>
      <span title="缓存读取 token">⇄ {fmt(t?.cacheRead ?? 0)}</span>
      <span title="缓存命中率">命中 {(hitRate * 100).toFixed(0)}%</span>
      <span className="text-emerald-400" title="累计费用（美元）">
        ${(summary?.cost ?? 0).toFixed(4)}
      </span>
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
