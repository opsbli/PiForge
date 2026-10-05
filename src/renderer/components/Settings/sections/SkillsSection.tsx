import { useMemo, type JSX } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  ChipList,
  NoticeBlock,
  SectionShell,
  SettingsGroup,
  SettingsRow,
  ValueText
} from '../SettingsLayout'

/** Skill：按来源目录分组的已加载 skill */
export function SkillsSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resources = useSettingsStore((s) => s.resources)
  const resolved = settings?.resolved

  const skills = resources?.skills ?? []
  const diagnostics = resources?.skillDiagnostics ?? []

  // 按来源目录分组，便于看出「哪些来自用户级、哪些来自项目级」
  const grouped = useMemo(() => {
    const map = new Map<string, typeof skills>()
    for (const skill of skills) {
      const key = skill.baseDir || skill.filePath || '(来源未知)'
      const bucket = map.get(key)
      if (bucket) bucket.push(skill)
      else map.set(key, [skill])
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [skills])

  return (
    <SectionShell
      title="Skill"
      description="Skill 是按需载入的能力说明。模型提示里只会出现未被标记为「仅手动调用」的项。"
    >
      <SettingsGroup title={`已加载 skill（${skills.length} 个，来自 ${grouped.length} 个目录）`}>
        {grouped.length === 0 ? (
          <SettingsRow label="暂无 skill">
            <ValueText value={null} />
          </SettingsRow>
        ) : (
          grouped.map(([dir, items]) => (
            <SettingsRow key={dir} label={`${items.length} 个`} hint={dir} mono>
              <ChipList items={items.map((skill) => skill.name)} />
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      {diagnostics.length > 0 && (
        <SettingsGroup title="加载诊断">
          {diagnostics.map((item) => (
            <SettingsRow key={`${item.path}:${item.message}`} label={item.message} hint={item.path}>
              <span className={item.severity === 'error' ? 'text-destructive' : 'text-warning'}>
                {item.severity === 'error' ? '错误' : '警告'}
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title="已配置的 skill 路径">
        <SettingsRow label="用户级" hint="agent 目录 settings.json 的 skills">
          <ChipList items={resolved?.skillPaths ?? []} empty="未设置" />
        </SettingsRow>
        <SettingsRow label="项目级" hint=".pi/settings.json 的 skills">
          <ChipList items={toSourceList(settings?.project.skills)} empty="未设置" />
        </SettingsRow>
        <SettingsRow
          label="注册为斜杠命令"
          hint="enableSkillCommands；TUI 概念，对 GUI 无影响"
        >
          <ValueText value={resolved?.enableSkillCommands} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="标记为仅手动调用的 skill"
        description="disableModelInvocation：不会进入模型提示，只能由用户显式调用。"
      >
        <SettingsRow label="清单">
          <ChipList
            items={skills.filter((skill) => skill.disableModelInvocation).map((s) => s.name)}
            empty="无"
          />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        本分类本轮只读。启用 / 停用 skill（通过资源路径的排除语法）将在 P3 开放，
        并需要重载 agent 生效。
      </NoticeBlock>
    </SectionShell>
  )
}

/** 项目级字段可能是字符串或字符串数组，统一成字符串数组 */
function toSourceList(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.map((item) => String(item))
  return []
}
