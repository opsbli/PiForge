import type { JSX } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsFieldRow } from '../SettingsFieldRow'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow,
  ValueText
} from '../SettingsLayout'

/** 扩展（插件）：已加载扩展、加载诊断与扩展路径 */
export function ExtensionsSection(): JSX.Element {
  const resources = useSettingsStore((s) => s.resources)

  const extensions = resources?.extensions ?? []
  const diagnostics = resources?.extensionDiagnostics ?? []
  const builtinCount = extensions.filter((extension) => extension.builtin).length

  return (
    <SectionShell
      title="扩展"
      description="扩展在 agent 进程内执行代码。列表来自运行中的 agent，是实际加载结果。"
    >
      <SettingsGroup
        title={`已加载扩展（${extensions.length} 个，其中内置 ${builtinCount} 个）`}
        description="内置扩展只在 CLI 与 TUI 下默认加载；SDK 会话不会自动加载它们。"
      >
        {extensions.length === 0 ? (
          <SettingsRow label="暂无扩展">
            <ValueText value={null} />
          </SettingsRow>
        ) : (
          extensions.map((extension) => (
            <SettingsRow
              key={`${extension.path}#${extension.name}`}
              label={extension.name}
              hint={extension.path}
              mono
            >
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-muted-foreground">
                  {extension.builtin ? '内置' : extension.scope || '来源未标注'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {extension.toolCount} 工具 · {extension.commandCount} 命令
                </span>
              </div>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      {diagnostics.length > 0 && (
        <SettingsGroup title="加载诊断">
          {diagnostics.map((item) => (
            <SettingsRow key={`${item.path}:${item.message}`} label={item.message} hint={item.path} mono>
              <span className={item.severity === 'error' ? 'text-destructive' : 'text-warning'}>
                {item.severity === 'error' ? '错误' : '警告'}
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup
        title="扩展路径"
        description="extensions 资源路径；项目级部分在项目被信任后才加载。内置扩展用 builtin:<名称> 引用。"
      >
        <SettingsFieldRow
          fieldKey="extensions"
          label="extensions"
          hint="可追加文件或目录；也可用 !**\/名称\/** 排除"
        />
      </SettingsGroup>

      <SettingsGroup title="其他已加载资源">
        <SettingsRow label="Skill">
          <ValueText value={resources?.counts.skills ?? null} />
        </SettingsRow>
        <SettingsRow label="Prompt 模板" hint="TUI 的斜杠命令，GUI 不做完整展示">
          <ValueText value={resources?.counts.prompts ?? null} />
        </SettingsRow>
        <SettingsRow label="主题" hint="TUI 概念，与 PiForge 的主题无关">
          <ValueText value={resources?.counts.themes ?? null} />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock tone="warning">
        扩展在 agent 进程内执行代码。添加扩展路径等同于允许其代码运行，保存前请确认来源可信。
        写入后需要重载 agent 才会加载。Pi packages 的安装与移除在「Packages」分类。
      </NoticeBlock>
    </SectionShell>
  )
}
