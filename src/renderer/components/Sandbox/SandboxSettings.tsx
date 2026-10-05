import { useEffect, type JSX } from 'react'
import { useSandboxStore } from '@renderer/stores/sandbox-store'
import { cn } from '@renderer/lib/utils'

/** header 里的沙箱状态指示器 */
export function SandboxBadge(): JSX.Element {
  const status = useSandboxStore((s) => s.status)
  const refresh = useSandboxStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const isDocker = status?.mode === 'docker'
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs',
        isDocker ? 'text-emerald-400' : 'text-muted-foreground'
      )}
      title={isDocker ? `Docker 隔离（容器 ${status?.containerId?.slice(0, 12) ?? ''}）` : '本地受限子进程'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isDocker ? 'bg-emerald-400' : 'bg-amber-400')} />
      {isDocker ? 'Docker 隔离' : '本地受限'}
    </span>
  )
}

/** 沙箱设置区（嵌入设置对话框） */
export function SandboxSettings(): JSX.Element {
  const status = useSandboxStore((s) => s.status)
  const busy = useSandboxStore((s) => s.busy)
  const refresh = useSandboxStore((s) => s.refresh)
  const setMode = useSandboxStore((s) => s.setMode)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const docker = status?.docker

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="text-xs font-semibold text-foreground">执行沙箱</div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        本地受限子进程（默认）或 Docker 容器隔离。Docker 模式会拒绝网络并 bind-mount 工作区到 /app。
      </p>

      <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          disabled={busy || !docker?.daemonRunning}
          checked={status?.mode === 'docker'}
          onChange={(e) => void setMode(e.target.checked ? 'docker' : 'local')}
        />
        启用 Docker 沙箱
        {busy && <span className="text-muted-foreground">（切换中…）</span>}
      </label>

      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <div>Docker CLI：{docker?.cliAvailable ? (docker.version ?? '可用') : '不可用'}</div>
        <div>守护进程：{docker?.daemonRunning ? '运行中' : '未运行'}</div>
        <div>沙箱镜像：{docker?.imageReady ? '已就绪' : '未拉取'}</div>
        {docker?.error && <div className="text-amber-400">{docker.error}</div>}
      </div>
    </div>
  )
}
