import { useCallback, useEffect, useState, type JSX } from 'react'
import { Download, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import type { PackageInfo, PackageProgress } from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Segmented, type SegmentedOption } from '@renderer/components/ui/segmented'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

type PendingAction =
  | { kind: 'install'; source: string; local: boolean }
  | { kind: 'remove'; source: string; local: boolean }
  | { kind: 'update'; source?: string }

type ScopeChoice = 'user' | 'project'

const SCOPE_OPTIONS: SegmentedOption<ScopeChoice>[] = [
  { value: 'user', label: '用户级', title: '写入 agent 目录的 settings.json' },
  { value: 'project', label: '项目级', title: '写入 .pi/settings.json' }
]

/** Pi packages：列表 + 安装 / 移除 / 更新。动作会真实执行 npm 或 git。 */
export function PackagesSection(): JSX.Element {
  const trust = useSettingsStore((s) => s.trust)

  const [packages, setPackages] = useState<PackageInfo[]>([])
  const [source, setSource] = useState('')
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>('user')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<PackageProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.piforge.listPackages()
    if (!result) {
      setError('agent 未就绪，无法读取 packages')
      return
    }
    setPackages(result.packages)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => window.piforge.onPackagesProgress(setProgress), [])

  const run = async (action: PendingAction): Promise<void> => {
    setPending(null)
    setBusy(true)
    setError(null)
    setProgress(null)
    try {
      const result =
        action.kind === 'install'
          ? await window.piforge.installPackage({ source: action.source, local: action.local })
          : action.kind === 'remove'
            ? await window.piforge.removePackage({ source: action.source, local: action.local })
            : await window.piforge.updatePackages(action.source ? { source: action.source } : {})

      if (!result) {
        setError('agent 未就绪，动作未执行')
        return
      }
      setPackages(result.packages)
      if (!result.ok) setError(result.error ?? '操作失败')
      else if (action.kind === 'install') setSource('')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const projectUntrusted = trust !== null && !trust.loaderTrusted

  return (
    <SectionShell
      title="Packages"
      description="一个 Pi package 可以同时提供扩展、skill、prompt 模板与主题。安装与更新会执行 npm 或 git。"
    >
      <SettingsGroup
        title={`已配置的 packages（${packages.length} 个）`}
        description="来源可以是 npm 包名、git 仓库或本地目录。"
      >
        {packages.length === 0 ? (
          <SettingsRow label="暂无 packages">
            <ValueText value={null} />
          </SettingsRow>
        ) : (
          packages.map((entry) => (
            <SettingsRow
              key={`${entry.scope}#${entry.source}`}
              label={entry.source}
              hint={entry.installedPath ?? '未安装到本地（或尚未解析）'}
              mono
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {entry.scope === 'user' ? '用户级' : '项目级'}
                  {entry.filtered ? ' · 已过滤资源' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="更新"
                  aria-label={`更新 ${entry.source}`}
                  disabled={busy}
                  onClick={() => setPending({ kind: 'update', source: entry.source })}
                >
                  <RefreshCw />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive"
                  title="移除"
                  aria-label={`移除 ${entry.source}`}
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      kind: 'remove',
                      source: entry.source,
                      local: entry.scope === 'project'
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      <SettingsGroup title="安装" description="npm 包名、git 仓库地址，或本地目录路径。">
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={source}
              placeholder="例如 @scope/pi-package 或 https://github.com/user/repo"
              onChange={(event) => setSource(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && source.trim() && !busy) {
                  setPending({ kind: 'install', source: source.trim(), local: scopeChoice === 'project' })
                }
              }}
            />
            <Segmented
              value={scopeChoice}
              onValueChange={setScopeChoice}
              options={SCOPE_OPTIONS}
              className="shrink-0"
            />
            <Button
              variant="default"
              className="shrink-0"
              disabled={busy || !source.trim()}
              onClick={() =>
                setPending({ kind: 'install', source: source.trim(), local: scopeChoice === 'project' })
              }
            >
              <Download />
              安装…
            </Button>
          </div>

          {projectUntrusted && scopeChoice === 'project' && (
            <p className="mt-1.5 text-[11px] text-warning">
              当前项目未被信任，项目级安装会被拒绝。可到「项目与信任」查看原因。
            </p>
          )}

          {busy && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {progress
                ? `${progress.action} · ${progress.type}${progress.message ? ` · ${progress.message}` : ''}`
                : '正在执行…'}
            </p>
          )}

          {error && (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] text-destructive">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <SettingsRow label="全部更新" hint="对所有已配置的 packages 执行更新">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || packages.length === 0}
            onClick={() => setPending({ kind: 'update' })}
          >
            更新全部…
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        packages 不作为普通字段直接编辑：对象形式的来源可以带资源过滤配置，
        直接改写会丢失这部分信息，因此统一通过安装 / 移除动作维护。
        动作完成后需要重载 agent 才会加载新资源。
      </NoticeBlock>

      <PackageConfirmDialog pending={pending} onCancel={() => setPending(null)} onConfirm={run} />
    </SectionShell>
  )
}

function PackageConfirmDialog({
  pending,
  onCancel,
  onConfirm
}: {
  pending: PendingAction | null
  onCancel: () => void
  onConfirm: (action: PendingAction) => Promise<void>
}): JSX.Element | null {
  const [running, setRunning] = useState(false)

  if (!pending) return null

  const scopeLabel = pending.kind !== 'update' && pending.local ? '项目级' : '用户级'

  const detail =
    pending.kind === 'install' ? (
      <>
        将对 <span className="font-mono">{pending.source}</span> 执行安装：npm 包会通过 npm
        下载并可能运行包的安装脚本；git 来源会 clone 仓库。安装结果会写入{scopeLabel}
        配置文件。
      </>
    ) : pending.kind === 'remove' ? (
      <>
        将从{scopeLabel}配置中移除 <span className="font-mono">{pending.source}</span>
        ，并删除已安装的本地目录。
      </>
    ) : (
      <>
        将对 {pending.source ? <span className="font-mono">{pending.source}</span> : '所有已配置的 packages'}{' '}
        执行更新（npm update 或 git pull）。
      </>
    )

  return (
    <Dialog open onClose={running ? () => undefined : onCancel} className="max-w-lg">
      <DialogHeader
        title={
          pending.kind === 'install' ? '确认安装 package' : pending.kind === 'remove' ? '确认移除 package' : '确认更新 packages'
        }
        icon={<TriangleAlert className="size-4 text-warning" />}
        onClose={running ? undefined : onCancel}
      />
      <DialogBody>
        <p className="text-xs leading-relaxed text-foreground">{detail}</p>
        <div className="mt-3">
          <NoticeBlock tone="warning">
            这一步会在 agent 进程中真实执行外部命令，可能联网并运行第三方安装脚本。
            确认来源可信后再继续；执行期间进度会显示在列表上方。
          </NoticeBlock>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={running} onClick={onCancel}>
          取消
        </Button>
        <Button
          variant="danger"
          disabled={running}
          onClick={() => {
            setRunning(true)
            void onConfirm(pending).finally(() => setRunning(false))
          }}
        >
          {running ? '执行中…' : '确认执行'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
