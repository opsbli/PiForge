import { useState, type JSX } from 'react'
import { ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { ChipList, NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

type PendingTrust = { decision: boolean | null }

/** 项目与信任：受保护资源、已保存的信任决定与默认策略 */
export function TrustSection(): JSX.Element {
  const trust = useSettingsStore((s) => s.trust)
  const setTrust = useSettingsStore((s) => s.setTrust)

  const [pending, setPending] = useState<PendingTrust | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const decisionLabel =
    trust?.decision === null || trust?.decision === undefined
      ? '无已保存的决定'
      : trust.decision
        ? '已信任'
        : '已拒绝'

  const apply = async (decision: boolean | null): Promise<void> => {
    setPending(null)
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const result = await window.piforge.writeTrust({ decision })
      if (!result) {
        setError('agent 未就绪，未写入')
        return
      }
      setTrust(result.trust)
      if (!result.ok) setError(result.error ?? '写入失败')
      else setNote(result.note ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionShell
      title="项目与信任"
      description="项目信任决定工作目录下的 .pi 配置与可执行资源是否加载。它不是沙箱，不限制工具能访问的文件。"
    >
      <SettingsGroup title="当前项目">
        <SettingsRow label="工作目录">
          <ValueText value={trust?.cwd} mono />
        </SettingsRow>
        <SettingsRow label="是否需要信任决定" hint="探测到受保护的项目资源时为「是」">
          <ValueText value={trust?.requiresTrust} />
        </SettingsRow>
        <SettingsRow label="运行中的加载器" hint="当前 agent 会话按已信任还是未信任加载">
          <ValueText value={trust ? (trust.loaderTrusted ? '已信任' : '未信任') : null} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="已保存的决定"
        description="保存在 agent 目录的 trust.json，按规范化目录路径记录。"
      >
        <SettingsRow label="当前目录的决定">
          <ValueText value={decisionLabel} />
        </SettingsRow>
        <SettingsRow label="trust.json">
          <ValueText value={trust?.savedPath} mono />
        </SettingsRow>
        <SettingsFieldRow
          fieldKey="defaultProjectTrust"
          label="defaultProjectTrust"
          hint="无已保存决定时的默认策略；只能写在用户级配置，且影响今后所有项目"
          enumLabels={{
            ask: 'ask（无交互入口时等同拒绝）',
            always: 'always（自动信任）',
            never: 'never（一律不信任）'
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="探测到的受保护资源">
        <SettingsRow label="清单" hint="这些资源会触发信任要求">
          <ChipList items={trust?.protectedResources ?? []} empty="未探测到" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="变更信任决定">
        <SettingsRow
          label="信任此项目"
          hint="允许加载 .pi 下的扩展、skill、MCP 配置与系统提示文件"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={busy || trust?.loaderTrusted === true}
            onClick={() => setPending({ decision: true })}
          >
            <ShieldCheck />
            信任…
          </Button>
        </SettingsRow>
        <SettingsRow label="拒绝此项目" hint="不加载项目级配置与资源（不影响工具权限）">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || trust?.loaderTrusted === false}
            onClick={() => setPending({ decision: false })}
          >
            <ShieldOff />
            拒绝…
          </Button>
        </SettingsRow>
        <SettingsRow label="清除已保存的决定" hint="下次启动重新按 defaultProjectTrust 决定">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || trust?.decision === null || trust?.decision === undefined}
            onClick={() => setPending({ decision: null })}
          >
            清除…
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {error && (
        <NoticeBlock tone="warning">
          <span className="flex items-start gap-1.5">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            <span>{error}</span>
          </span>
        </NoticeBlock>
      )}
      {note && <NoticeBlock>{note}</NoticeBlock>}

      <NoticeBlock tone="warning">
        信任一个目录等同于允许其中的扩展与 MCP 配置自动加载并执行代码。信任不会限制工具能访问
        的文件或网络，它是资源配置门禁，不是安全边界。变更后会立即重载当前会话。
      </NoticeBlock>

      <TrustConfirmDialog
        pending={pending}
        loaderTrusted={trust?.loaderTrusted ?? false}
        onCancel={() => setPending(null)}
        onConfirm={apply}
      />
    </SectionShell>
  )
}

function TrustConfirmDialog({
  pending,
  loaderTrusted,
  onCancel,
  onConfirm
}: {
  pending: PendingTrust | null
  loaderTrusted: boolean
  onCancel: () => void
  onConfirm: (decision: boolean | null) => Promise<void>
}): JSX.Element | null {
  const [running, setRunning] = useState(false)
  if (!pending) return null

  const title =
    pending.decision === null
      ? '确认清除信任决定'
      : pending.decision
        ? '确认信任此项目'
        : '确认拒绝此项目'

  const body =
    pending.decision === null ? (
      <>
        将从 trust.json 中删除当前目录的决定。当前会话会按「未信任」重载；
        下次启动将按 defaultProjectTrust 决定。
      </>
    ) : pending.decision ? (
      <>
        信任后，该目录下 .pi/extensions、.pi/skills、.pi/mcp.json、SYSTEM.md 等资源会被自动加载，
        其中扩展与 stdio MCP 服务器会在 agent 进程内执行代码或启动进程。
        仅在完全了解该目录内容时才信任。
      </>
    ) : (
      <>
        拒绝后，项目级配置与资源不再加载，当前会话会立即重载。
        这不会限制工具能访问的文件或网络，只影响配置加载。
      </>
    )

  return (
    <Dialog open onClose={running ? () => undefined : onCancel} className="max-w-lg">
      <DialogHeader
        title={title}
        description={`当前运行中的加载器：${loaderTrusted ? '已信任' : '未信任'}`}
        icon={<TriangleAlert className="size-4 text-warning" />}
        onClose={running ? undefined : onCancel}
      />
      <DialogBody>
        <p className="text-xs leading-relaxed text-foreground">{body}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={running} onClick={onCancel}>
          取消
        </Button>
        <Button
          variant={pending.decision === false ? 'danger' : 'default'}
          disabled={running}
          onClick={() => {
            setRunning(true)
            void onConfirm(pending.decision).finally(() => setRunning(false))
          }}
        >
          {running ? '处理中…' : '确认'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
