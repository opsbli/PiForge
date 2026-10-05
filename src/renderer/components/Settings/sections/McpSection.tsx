import type { JSX } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow,
  ValueText
} from '../SettingsLayout'

/**
 * MCP：只读现状。
 *
 * 本轮刻意不展示「连接状态」——实测 SDK 没有公开的按服务器连接状态 API，
 * 事件载荷只有注册信息。能拿到的只有「已注册的工具」，因此这里如实标注为推断。
 */
export function McpSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resources = useSettingsStore((s) => s.resources)

  const extensions = resources?.extensions ?? []
  const mcpExtensionLoaded = extensions.some(
    (extension) => extension.path === 'builtin:mcp' || extension.builtin
  )

  const mcpTools = (resources?.tools ?? []).filter((tool) => tool.origin === 'mcp')
  const servers = [...new Set(mcpTools.map((tool) => tool.server ?? '(未解析出服务器名)'))]

  const globalMcp = settings?.files.find((file) => file.path === settings.paths.globalMcp)
  const projectMcp = settings?.files.find((file) => file.path === settings.paths.projectMcp)

  return (
    <SectionShell
      title="MCP"
      description="Model Context Protocol 服务器。PiForge 当前尚未把 MCP 接入 agent 会话，因此这里只呈现现状与配置位置。"
    >
      <SettingsGroup title="运行时状态">
        <SettingsRow
          label="内置 MCP 扩展"
          hint="builtin:mcp。SDK 会话不会自动加载内置扩展，需要显式注入 createMcpExtension"
        >
          <ValueText value={mcpExtensionLoaded ? '已加载' : '未加载'} />
        </SettingsRow>
        <SettingsRow label="已接入的 MCP 工具">
          <ValueText value={mcpTools.length} />
        </SettingsRow>
        <SettingsRow
          label="涉及到的服务器"
          hint="由已注册工具名推断；不是实时连接状态（SDK 未提供该 API）"
        >
          <ChipList items={servers} empty="无" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="配置文件" description="与常见 MCP 客户端一致的 mcpServers 格式。项目级文件在项目被信任后才读取。">
        <SettingsRow label="用户级 mcp.json" hint="对所有项目生效">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-[11px] text-foreground">{globalMcp?.path ?? '—'}</span>
            <span className={globalMcp?.exists ? 'text-success' : 'text-muted-foreground'}>
              {globalMcp?.exists ? '已存在' : '不存在'}
            </span>
          </div>
        </SettingsRow>
        <SettingsRow label="项目级 mcp.json" hint=".pi/mcp.json，仅本项目">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-[11px] text-foreground">{projectMcp?.path ?? '—'}</span>
            <span className={projectMcp?.exists ? 'text-success' : 'text-muted-foreground'}>
              {projectMcp?.exists ? '已存在' : '不存在'}
            </span>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock tone="warning">
        未接入的原因已核实：SDK 文档明确写着「SDK sessions do not load built-in extensions」，
        而 PiForge 目前只注入了审批与记忆两个扩展。接入需要显式注入 createMcpExtension，
        并按 exposure 追加 codemode / tool-search。这部分与服务器增删改一起在 P4 实现。
      </NoticeBlock>
    </SectionShell>
  )
}
