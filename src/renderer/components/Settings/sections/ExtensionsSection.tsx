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

/** 扩展（插件）：已加载扩展、加载诊断与已配置的扩展路径 */
export function ExtensionsSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resources = useSettingsStore((s) => s.resources)
  const resolved = settings?.resolved

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

      <SettingsGroup title="已配置的扩展路径" description="settings.extensions；项目级配置在项目被信任后才加载。">
        <SettingsRow label="用户级" hint="agent 目录 settings.json">
          <ChipList items={resolved?.extensionPaths ?? []} />
        </SettingsRow>
        <SettingsRow label="项目级" hint=".pi/settings.json 的 extensions">
          <ChipList
            items={toStringList((settings?.project.extensions as unknown) ?? [])}
            empty="未设置"
          />
        </SettingsRow>
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

      <NoticeBlock>
        本分类本轮只读。添加/移除扩展路径、安装 Pi packages 将在 P3 开放，
        并需要重载 agent 生效。添加扩展路径等同于允许其代码在 agent 进程内执行，
        届时会先展示影响并要求确认。
      </NoticeBlock>
    </SectionShell>
  )
}

/** 项目级字段可能是字符串、字符串数组或未设置，统一成字符串数组 */
function toStringList(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.map((item) => String(item))
  return []
}
