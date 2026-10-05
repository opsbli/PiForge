import type { JSX } from 'react'
import { SandboxSettings } from '@renderer/components/Sandbox/SandboxSettings'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow,
  ValueText
} from '../SettingsLayout'

/** 工具：实际注册/激活的工具集、codemode 设置与执行沙箱 */
export function ToolsSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resources = useSettingsStore((s) => s.resources)
  const resolved = settings?.resolved

  const tools = resources?.tools ?? []
  const activeNames = tools.filter((tool) => tool.active).map((tool) => tool.name)
  const inactiveNames = tools.filter((tool) => !tool.active).map((tool) => tool.name)
  const builtinCount = tools.filter((tool) => tool.origin === 'builtin').length
  const mcpCount = tools.filter((tool) => tool.origin === 'mcp').length
  const extensionCount = tools.filter((tool) => tool.origin === 'extension').length

  return (
    <SectionShell
      title="工具"
      description="工具列表来自运行中的 agent 会话，是模型实际可见的注册结果，不是配置文件的推断。"
    >
      <SettingsGroup
        title="工具集"
        description="未设置 defaultTools 时使用内置默认 read / bash / edit / write。"
      >
        <SettingsRow label="defaultTools（显式配置）" hint="只显示配置文件中写入的值">
          {resolved?.defaultTools && resolved.defaultTools.length > 0 ? (
            <ChipList items={resolved.defaultTools} />
          ) : (
            <ValueText value={null} />
          )}
        </SettingsRow>
        <SettingsRow label="当前激活" hint="会向模型声明">
          <ChipList items={activeNames} empty="没有激活的工具" />
        </SettingsRow>
        <SettingsRow
          label="已注册总数"
          hint={`内置 ${builtinCount} · MCP ${mcpCount} · 扩展 ${extensionCount}`}
        >
          <ValueText value={tools.length} />
        </SettingsRow>
        <SettingsRow label="未激活" hint="已注册但当前不向模型声明">
          <ChipList items={inactiveNames} empty="无" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="codemode">
        <SettingsRow
          label="mode"
          hint="on：已声明的工具会附注可从脚本调用；only：直接从模型隐藏并由 codemode 代管"
        >
          <ValueText value={resolved?.codemodeMode} />
        </SettingsRow>
        <SettingsRow label="inlineBudget" hint="工具声明可占用的估算 token 数（字符数 / 4）">
          <ValueText value={resolved?.codemodeInlineBudget} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="执行沙箱">
        <SandboxSettings />
      </SettingsGroup>

      <NoticeBlock>
        沙箱模式切换已可用（沿用原有能力）。工具集与 codemode 设置为只读，写入将在 P2 开放；
        工具集的变更需要重载 agent 才能生效。
      </NoticeBlock>
    </SectionShell>
  )
}
