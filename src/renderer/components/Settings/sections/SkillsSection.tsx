import { useMemo, type JSX } from 'react'
import type { SkillInfo } from '@shared/ipc-types'
import { Switch } from '@renderer/components/ui/switch'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { readSettingsPath } from '@renderer/lib/settings-path'
import { exclusionPattern, isSkillDisabled } from '@renderer/lib/skill-exclusion'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { ChipList, NoticeBlock, SectionShell, SettingsGroup, SettingsRow, ValueText } from '../SettingsLayout'

/** 从 `!**\/<名>\/**` 这类排除模式里取出被排除的目录名 */
function dirNameFromPattern(pattern: string): string | null {
  const match = pattern.match(/^!.*\/([^/]+)\/\*\*$/)
  return match ? match[1] : null
}

interface SkillRow {
  name: string
  description: string
  baseDir: string
  filePath: string
  disableModelInvocation: boolean
  /** 当前是否已停用 */
  disabled: boolean
  /** 由排除模式反推出来的条目（不在当前加载结果里，没有元信息） */
  synthesized: boolean
}

/** Skill：按来源分组展示，并对每个 skill 提供停用 / 启用 */
export function SkillsSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resources = useSettingsStore((s) => s.resources)
  const scope = useSettingsStore((s) => s.scope)
  const draft = useSettingsStore((s) => s.draft)
  const setDraftValue = useSettingsStore((s) => s.setDraftValue)

  // 实际生效的排除模式（全局 + 项目合并）
  const effectivePatterns = (readSettingsPath(settings?.resolvedValues, 'skills') as string[] | null) ?? []
  // 当前 scope 下**显式**写入的数组：开关只改这一份，避免把用户级的模式复制进项目文件
  const scopedSource = scope === 'global' ? settings?.global : settings?.project
  const scopedPatterns = (readSettingsPath(scopedSource, 'skills') as string[] | null) ?? []

  const rows = useMemo<SkillRow[]>(() => {
    const loaded: SkillRow[] = (resources?.skills ?? []).map((skill: SkillInfo) => ({
      name: skill.name,
      description: skill.description,
      baseDir: skill.baseDir,
      filePath: skill.filePath,
      disableModelInvocation: skill.disableModelInvocation,
      disabled: isSkillDisabled(skill, effectivePatterns),
      synthesized: false
    }))

    // 被停用的 skill 不会出现在加载结果里，从排除模式反推补回来，否则无法再启用
    const knownDirs = new Set(loaded.map((row) => row.baseDir))
    const synthesized: SkillRow[] = []
    for (const pattern of effectivePatterns) {
      const name = dirNameFromPattern(pattern)
      if (!name) continue
      const alreadyShown = loaded.some((row) => row.baseDir.split(/[\\/]+/).filter(Boolean).pop() === name)
      if (alreadyShown) continue
      if (knownDirs.has(name)) continue
      synthesized.push({
        name,
        description: '已停用，不在当前加载结果中（缺少描述信息）',
        baseDir: '',
        filePath: '',
        disableModelInvocation: false,
        disabled: true,
        synthesized: true
      })
    }

    return [...loaded, ...synthesized]
  }, [resources?.skills, effectivePatterns])

  const grouped = useMemo(() => {
    const map = new Map<string, SkillRow[]>()
    for (const row of rows) {
      const key = row.synthesized ? '(已停用)' : row.baseDir || row.filePath || '(来源未知)'
      const bucket = map.get(key)
      if (bucket) bucket.push(row)
      else map.set(key, [row])
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [rows])

  const toggle = (row: SkillRow, enabled: boolean): void => {
    const sample: SkillInfo = {
      name: row.name,
      description: row.description,
      filePath: row.filePath,
      baseDir: row.baseDir,
      source: '',
      scope: '',
      disableModelInvocation: row.disableModelInvocation
    }
    const pattern = exclusionPattern(sample)
    if (!pattern) return
    const next = enabled
      ? scopedPatterns.filter((candidate) => candidate !== pattern)
      : [...new Set([...scopedPatterns, pattern])]
    setDraftValue('skills', next.length > 0 ? next : null)
  }

  const diagnostics = resources?.skillDiagnostics ?? []

  return (
    <SectionShell
      title="Skill"
      description="Skill 是按需载入的能力说明。停用采用资源排除语法，按 skill 目录名匹配。"
    >
      <SettingsGroup title={`已发现的 skill（${rows.length} 个）`}>
        {grouped.length === 0 ? (
          <SettingsRow label="暂无 skill">
            <ValueText value={null} />
          </SettingsRow>
        ) : (
          grouped.map(([dir, items]) => (
            <div key={dir}>
              <div className="bg-card/30 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {dir} · {items.length} 个
              </div>
              {items.map((row) => (
                <SettingsRow
                  key={`${dir}#${row.name}`}
                  label={row.name}
                  hint={row.synthesized ? row.description : row.description.slice(0, 140)}
                >
                  <div className="flex items-center gap-2">
                    {row.disableModelInvocation && (
                      <span className="text-[10px] text-muted-foreground">仅手动调用</span>
                    )}
                    <span className={row.disabled ? 'text-warning' : 'text-success'}>
                      {row.disabled ? '已停用' : '启用中'}
                    </span>
                    <Switch
                      checked={!row.disabled}
                      onChange={(next) => toggle(row, next)}
                      label={`${row.disabled ? '启用' : '停用'} ${row.name}`}
                    />
                  </div>
                </SettingsRow>
              ))}
            </div>
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

      <SettingsGroup title="额外的 skill 路径" description="skills 资源路径；项目级部分在项目被信任后才加载。">
        <SettingsFieldRow
          fieldKey="skills"
          label="skills"
          hint="可以追加目录，也可以用 !**\/名称\/** 排除"
        />
      </SettingsGroup>

      <SettingsGroup title="当前生效的排除模式" description="全局与项目级合并后的结果。">
        <SettingsRow label="排除模式">
          <ChipList items={effectivePatterns} empty="无" />
        </SettingsRow>
        <SettingsRow label="本项目 scope 下的显式值">
          <ChipList items={scopedPatterns} empty="本项目 scope 下未显式设置" />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock tone="warning">
        停用按 skill 目录名匹配（已实测：相对路径排除会静默失效，只有 glob 与绝对路径有效），
        因此不同来源若存在同名 skill 会一起停用。开关改动写入当前选择的 scope，
        保存后需要重载 agent 才会生效。
      </NoticeBlock>
    </SectionShell>
  )
}
