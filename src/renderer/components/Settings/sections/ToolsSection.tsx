import type { JSX } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { ChipList, NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 工具：工具集与 codemode 可写；工具清单为实际状态 */
export function ToolsSection(): JSX.Element {
  const resources = useSettingsStore((s) => s.resources)

  const tools = resources?.tools ?? []
  const activeNames = tools.filter((tool) => tool.active).map((tool) => tool.name)
  const inactiveNames = tools.filter((tool) => !tool.active).map((tool) => tool.name)
  const builtinCount = tools.filter((tool) => tool.origin === 'builtin').length
  const mcpCount = tools.filter((tool) => tool.origin === 'mcp').length
  const extensionCount = tools.filter((tool) => tool.origin === 'extension').length

  return (
    <SectionShell
      title="工具"
      description="工具清单来自运行中的 agent 会话，是模型实际可见的注册结果；配置项写入后需要重载才会重建工具集。"
    >
      <SettingsGroup
        title="工具集"
        description="defaultTools 未设置时使用内置默认 read / bash / edit / write。数组内可用 +name 追加、-name 移除。"
      >
        <SettingsFieldRow
          fieldKey="defaultTools"
          label="defaultTools"
          hint="留空数组表示禁用全部内置工具（不等于回到默认）"
        />
        <SettingsFieldRow
          fieldKey="codemode.mode"
          label="codemode.mode"
          hint="on：已声明的工具附注可从脚本调用；only：直接从模型隐藏"
          enumLabels={{ on: 'on（附加提示）', only: 'only（完全代管）' }}
        />
        <SettingsFieldRow
          fieldKey="codemode.inlineBudget"
          label="codemode.inlineBudget"
          hint="工具声明可占用的估算 token 数（字符数 / 4）"
        />
      </SettingsGroup>

      <SettingsGroup title="当前生效的工具集" description="来自运行中的会话，反映重载后的实际结果。">
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

      <NoticeBlock>
        工具集的变更需要重载 agent（保存后右上角会出现「立即重载」）。沙箱相关设置在左侧「沙箱」分类里。
      </NoticeBlock>
    </SectionShell>
  )
}
