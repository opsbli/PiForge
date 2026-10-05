import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import { listTraces, listSpans, getStats } from '../trace-store'

/** 本地可观测性 IPC（读取 trace / span / 汇总统计） */
export function registerTraceIpc(): void {
  ipcMain.handle(IPC.TRACE_LIST, async (_event, limit: unknown) => {
    return listTraces(typeof limit === 'number' ? limit : 50)
  })

  ipcMain.handle(IPC.TRACE_SPANS, async (_event, traceId: unknown) => {
    if (typeof traceId !== 'string') return []
    return listSpans(traceId)
  })

  ipcMain.handle(IPC.TRACE_STATS, async () => {
    return getStats()
  })
}
