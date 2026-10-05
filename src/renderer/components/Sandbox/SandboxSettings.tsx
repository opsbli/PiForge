import { useEffect, type JSX } from 'react'
import { ShieldCheck } from 'lucide-react'
import { StatusDot } from '@renderer/components/ui/badge'
import { useSandboxStore } from '@renderer/stores/sandbox-store'

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
  const isDocker = status?.mode === 'docker'

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ShieldCheck className="size-3.5 text-muted-foreground" />
        执行沙箱
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        本地受限子进程（默认）或 Docker 容器隔离。Docker 模式会拒绝网络并 bind-mount 工作区到
        /app。
      </p>

      <label className="mt-2.5 flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          disabled={busy || !docker?.daemonRunning}
          checked={isDocker}
          onChange={(event) => void setMode(event.target.checked ? 'docker' : 'local')}
        />
        启用 Docker 沙箱
        {busy && <span className="text-muted-foreground">（切换中…）</span>}
      </label>

      <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <InfoRow ok={Boolean(docker?.cliAvailable)} label="Docker CLI" value={docker?.version ?? '可用'} />
        <InfoRow ok={Boolean(docker?.daemonRunning)} label="守护进程" value="运行中" />
        <InfoRow ok={Boolean(docker?.imageReady)} label="沙箱镜像" value="已就绪" />
      </dl>

      {docker?.error && <p className="mt-1 text-[11px] text-warning">{docker.error}</p>}
    </div>
  )
}

function InfoRow({
  ok,
  label,
  value
}: {
  ok: boolean
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <StatusDot tone={ok ? 'success' : 'neutral'} />
      <dt>{label}：</dt>
      <dd>{ok ? value : '不可用'}</dd>
    </div>
  )
}
