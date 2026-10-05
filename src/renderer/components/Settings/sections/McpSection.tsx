import { useCallback, useEffect, useState, type JSX } from 'react'
import { Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import type {
  McpConfigView,
  McpExposureName,
  McpServerView,
  McpTransportKind
} from '@shared/ipc-types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

const EXPOSURES: McpExposureName[] = ['codemode', 'deferred', 'direct', 'hidden']

const EXPOSURE_LABELS: Record<McpExposureName, string> = {
  codemode: 'codemode（仅脚本可达）',
  deferred: 'deferred（搜索后声明）',
  direct: 'direct（直接声明给模型）',
  hidden: 'hidden（不可达）'
}

interface DraftServer {
  name: string
  transport: McpTransportKind
  command: string
  args: string
  url: string
  exposure: McpExposureName
  description: string
  /** 每行一条 KEY=VALUE */
  envText: string
  headerText: string
  scope: 'global' | 'project'
}

const EMPTY_DRAFT: DraftServer = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  exposure: 'codemode',
  description: '',
  envText: '',
  headerText: '',
  scope: 'global'
}

/** 每行 KEY=VALUE → 映射；空行忽略 */
function parsePairs(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return result
}

/** MCP：配置管理 + 运行时接入状态 */
export function McpSection(): JSX.Element {
  const trust = useSettingsStore((s) => s.trust)
  const resources = useSettingsStore((s) => s.resources)

  const [config, setConfig] = useState<McpConfigView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftServer | null>(null)
  const [pendingRemove, setPendingRemove] = useState<McpServerView | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.piforge.readMcpConfig()
      if (!result) {
        setError('agent 未就绪，无法读取 MCP 配置')
        return
      }
      setConfig(result.config)
      if (!result.ok) setError(result.error ?? '读取失败')
      else setError(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mcpTools = (resources?.tools ?? []).filter((tool) => tool.origin === 'mcp')
  const serversWithTools = [...new Set(mcpTools.map((tool) => tool.server ?? '(未解析)'))]

  const applyPatch = async (
    server: McpServerView,
    patch: { enabled?: boolean; exposure?: McpExposureName }
  ): Promise<void> => {
    const result = await window.piforge.patchMcpServer({
      scope: server.source,
      name: server.name,
      ...patch
    })
    if (!result) return
    setConfig(result.config)
    if (!result.ok) setError(result.error ?? '修改失败')
    else setError(null)
  }

  const submitDraft = async (): Promise<void> => {
    if (!draft) return
    const env = parsePairs(draft.envText)
    const headers = parsePairs(draft.headerText)

    const result = await window.piforge.upsertMcpServer({
      scope: draft.scope,
      name: draft.name.trim(),
      config: {
        transport: draft.transport,
        ...(draft.transport === 'stdio'
          ? {
              command: draft.command.trim(),
              args: draft.args.trim() ? draft.args.trim().split(/\s+/) : []
            }
          : { url: draft.url.trim() }),
        exposure: draft.exposure,
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        // 只在用户真的填了内容时整体替换，避免误清空已有凭据
        ...(Object.keys(env).length > 0 ? { env } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {})
      }
    })

    setDraft(null)
    if (!result) return
    setConfig(result.config)
    if (!result.ok) setError(result.error ?? '写入失败')
    else setError(null)
  }

  const confirmRemove = async (): Promise<void> => {
    const server = pendingRemove
    setPendingRemove(null)
    if (!server) return
    const result = await window.piforge.removeMcpServer({
      scope: server.source,
      name: server.name
    })
    if (!result) return
    setConfig(result.config)
    if (!result.ok) setError(result.error ?? '删除失败')
    else setError(null)
  }

  return (
    <SectionShell
      title="MCP"
      description="Model Context Protocol 服务器。已接入运行时：配置中的服务器会随会话启动连接。"
    >
      <SettingsGroup title="运行时状态">
        <SettingsRow
          label="已接入的 MCP 工具"
          hint="来自运行中的会话；改配置后需要重载才会生效"
        >
          <ValueText value={mcpTools.length} />
        </SettingsRow>
        <SettingsRow
          label="已出现工具的服务器"
          hint="由工具名推断，不是实时连接状态（SDK 未提供该 API）"
        >
          <ValueText
            value={serversWithTools.length > 0 ? serversWithTools.join(', ') : null}
          />
        </SettingsRow>
        <SettingsRow label="错误日志" hint="连接失败与服务器日志写在这里">
          <ValueText value={config?.logPath} mono />
        </SettingsRow>
        <SettingsRow label="OAuth 凭据文件" hint="与命令行共用：用 pi mcp login <server> 登录一次即可">
          <ValueText value={config?.authPath} mono />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title={`服务器（${config?.servers.length ?? 0} 个）`}
        description="用户级对所有项目生效；项目级仅本项目，且需要项目被信任。"
      >
        {(config?.servers ?? []).length === 0 ? (
          <SettingsRow label="尚未配置任何服务器">
            <ValueText value={null} />
          </SettingsRow>
        ) : (
          (config?.servers ?? []).map((server) => (
            <SettingsRow
              key={`${server.source}#${server.name}`}
              label={server.name}
              hint={
                server.transport === 'stdio'
                  ? `${server.command ?? ''} ${server.args.join(' ')}`.trim()
                  : (server.url ?? '')
              }
              mono
            >
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {server.source === 'global' ? '用户级' : '项目级'}
                    {server.overrideOf ? ` · 覆盖 ${server.overrideOf}` : ''}
                  </span>
                  <Select
                    className="h-6 text-[10px]"
                    value={server.exposure}
                    onChange={(event) =>
                      void applyPatch(server, {
                        exposure: event.target.value as McpExposureName
                      })
                    }
                  >
                    {EXPOSURES.map((exposure) => (
                      <option key={exposure} value={exposure}>
                        {EXPOSURE_LABELS[exposure]}
                      </option>
                    ))}
                  </Select>
                  <Switch
                    checked={server.enabled}
                    onChange={(next) => void applyPatch(server, { enabled: next })}
                    label={`${server.enabled ? '停用' : '启用'} ${server.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hover:text-destructive"
                    title="删除"
                    aria-label={`删除 ${server.name}`}
                    onClick={() => setPendingRemove(server)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {server.envKeys.length > 0 && <span>env: {server.envKeys.join(', ')}</span>}
                  {server.headerKeys.length > 0 && (
                    <span>headers: {server.headerKeys.join(', ')}</span>
                  )}
                  {server.error && <span className="text-destructive">{server.error}</span>}
                </span>
              </div>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      <SettingsGroup title="添加服务器">
        <SettingsRow label="新增" hint="名称只能包含字母、数字、_ 和 -">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft({ ...EMPTY_DRAFT, scope: trust?.loaderTrusted ? 'project' : 'global' })}
          >
            <Plus />
            添加…
          </Button>
        </SettingsRow>
        <SettingsRow
          label="重新读取"
          hint="在应用外编辑过 mcp.json 时用这个刷新"
        >
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw />
            刷新
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

      {(config?.errors ?? []).length > 0 && (
        <NoticeBlock tone="warning">
          配置问题：{config?.errors.join('；')}
        </NoticeBlock>
      )}

      <NoticeBlock>
        环境变量与请求头的值不回显（常含凭据），只显示键名；要改值需重新填写。
        开启 / 切换 exposure 会立即写入配置文件，但服务器要重载 agent 后才会连接。
        OAuth 服务器的登录无法在应用内发起（SDK 未开放该入口），请先用
        <span className="font-mono"> pi mcp login &lt;server&gt; </span>
        登录，凭据文件与命令行共用。
      </NoticeBlock>

      {draft && (
        <AddServerDialog
          draft={draft}
          projectAvailable={Boolean(trust?.loaderTrusted)}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onConfirm={submitDraft}
        />
      )}

      <Dialog open={pendingRemove !== null} onClose={() => setPendingRemove(null)} className="max-w-lg">
        <DialogHeader
          title="确认删除 MCP 服务器"
          description={pendingRemove?.name}
          icon={<TriangleAlert className="size-4 text-warning" />}
          onClose={() => setPendingRemove(null)}
        />
        <DialogBody>
          <p className="text-xs leading-relaxed text-foreground">
            将从{pendingRemove?.source === 'global' ? '用户级' : '项目级'}配置中移除该条目。
            原文件会先备份为 .bak。已启动的连接会在下次重载后一并停止。
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingRemove(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={() => void confirmRemove()}>
            确认删除
          </Button>
        </DialogFooter>
      </Dialog>
    </SectionShell>
  )
}

function AddServerDialog({
  draft,
  projectAvailable,
  onChange,
  onCancel,
  onConfirm
}: {
  draft: DraftServer
  projectAvailable: boolean
  onChange: (draft: DraftServer) => void
  onCancel: () => void
  onConfirm: () => Promise<void>
}): JSX.Element {
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<DraftServer>): void => onChange({ ...draft, ...patch })

  const invalid =
    !draft.name.trim() ||
    (draft.transport === 'stdio' ? !draft.command.trim() : !draft.url.trim())

  return (
    <Dialog open onClose={saving ? () => undefined : onCancel} className="max-w-2xl">
      <DialogHeader
        title="添加 MCP 服务器"
        description="写入后需要重载 agent 才会连接。"
        icon={<TriangleAlert className="size-4 text-warning" />}
        onClose={saving ? undefined : onCancel}
      />
      <DialogBody>
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">名称</span>
            <Input
              value={draft.name}
              placeholder="例如 filesystem"
              onChange={(event) => set({ name: event.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">传输方式</span>
              <Select
                value={draft.transport}
                onChange={(event) =>
                  set({ transport: event.target.value as McpTransportKind })
                }
              >
                <option value="stdio">stdio（本地进程）</option>
                <option value="http">http（streamable HTTP）</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">写入位置</span>
              <Select
                value={draft.scope}
                onChange={(event) =>
                  set({ scope: event.target.value as 'global' | 'project' })
                }
              >
                <option value="global">用户级</option>
                <option value="project" disabled={!projectAvailable}>
                  项目级{projectAvailable ? '' : '（项目未信任）'}
                </option>
              </Select>
            </label>
          </div>

          {draft.transport === 'stdio' ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">
                  command（单个可执行文件，不是 shell 字符串）
                </span>
                <Input
                  value={draft.command}
                  placeholder="例如 npx"
                  onChange={(event) => set({ command: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">args（空格分隔）</span>
                <Input
                  value={draft.args}
                  placeholder="例如 -y @modelcontextprotocol/server-filesystem ."
                  onChange={(event) => set({ args: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">
                  env（每行一条 KEY=VALUE，可引用 ${'${VAR}'}）
                </span>
                <Textarea
                  className="h-20 font-mono"
                  value={draft.envText}
                  placeholder={'API_KEY=${TOOLS_KEY}'}
                  onChange={(event) => set({ envText: event.target.value })}
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">url</span>
                <Input
                  value={draft.url}
                  placeholder="https://example.com/mcp"
                  onChange={(event) => set({ url: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">
                  headers（每行一条 KEY=VALUE；OAuth 服务器留空即可）
                </span>
                <Textarea
                  className="h-20 font-mono"
                  value={draft.headerText}
                  placeholder={'Authorization=Bearer ${DOCS_TOKEN}'}
                  onChange={(event) => set({ headerText: event.target.value })}
                />
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">exposure</span>
              <Select
                value={draft.exposure}
                onChange={(event) =>
                  set({ exposure: event.target.value as McpExposureName })
                }
              >
                {EXPOSURES.map((exposure) => (
                  <option key={exposure} value={exposure}>
                    {EXPOSURE_LABELS[exposure]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">描述（可选，会进入提示）</span>
              <Input
                value={draft.description}
                onChange={(event) => set({ description: event.target.value })}
              />
            </label>
          </div>

          <NoticeBlock tone="warning">
            stdio 条目定义的是今后会被启动的命令。确认 command 与 args 来自可信来源，再写入。
          </NoticeBlock>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          取消
        </Button>
        <Button
          variant="default"
          disabled={saving || invalid}
          onClick={() => {
            setSaving(true)
            void onConfirm().finally(() => setSaving(false))
          }}
        >
          {saving ? '写入中…' : '确认写入'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
