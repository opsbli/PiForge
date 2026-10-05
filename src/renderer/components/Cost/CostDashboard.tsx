import type { JSX } from 'react'
import { useEffect } from 'react'
import { useCostStore } from '@renderer/stores/cost-store'
import { formatCompactNumber } from '@renderer/lib/format'

/** 会话成本：token / 缓存命中 / 累计费用（中栏标题栏用） */
export function CostDashboard(): JSX.Element {
  const summary = useCostStore((s) => s.summary)
  const refreshSummary = useCostStore((s) => s.refreshSummary)

  // 首次拉取 + 每 5 秒轮询
  useEffect(() => {
    void refreshSummary()
    const timer = window.setInterval(() => void refreshSummary(), 5000)
    return () => window.clearInterval(timer)
  }, [refreshSummary])

  const usage = summary?.tokenUsage
  const cacheTotal = (usage?.cacheRead ?? 0) + (usage?.cacheWrite ?? 0)
  const inputTotal = (usage?.input ?? 0) + cacheTotal
  const hitRate = inputTotal > 0 ? (usage?.cacheRead ?? 0) / inputTotal : 0

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span title="输入 token（含缓存）">↓ {formatCompactNumber(usage?.input ?? 0)}</span>
      <span title="输出 token">↑ {formatCompactNumber(usage?.output ?? 0)}</span>
      <span title="缓存读取 token">⇄ {formatCompactNumber(usage?.cacheRead ?? 0)}</span>
      <span title="缓存命中率">命中 {(hitRate * 100).toFixed(0)}%</span>
      <span className="text-success" title="累计费用（美元）">
        ${(summary?.cost ?? 0).toFixed(4)}
      </span>
    </div>
  )
}
