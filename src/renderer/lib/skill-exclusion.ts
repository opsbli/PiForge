import type { SkillInfo } from '@shared/ipc-types'

/**
 * Skill 停用/启用用的资源排除模式。
 *
 * 实测结论（pi-coding-agent 1.0.2）：
 * - `!**\/<目录名>\/**` 这类 glob **生效**
 * - 绝对路径 `-<绝对文件路径>` 也生效
 * - **相对路径**（`-.pi/skills/x/SKILL.md`、`!.pi/skills/x/**`）**静默失效**，什么都不做
 *
 * 因此统一用 glob 形式：既可移植到其他机器（绝对路径写进项目级配置会在别的机器上失效），
 * 也不依赖工作区相对路径。代价是**按目录名匹配**，不同来源若存在同名 skill 会一起停用，
 * 界面上会如实说明这一点。
 */
export function exclusionPattern(skill: Pick<SkillInfo, 'baseDir' | 'name'>): string | null {
  const dirName = lastSegment(skill.baseDir)
  if (!dirName) return null
  return `!**/${dirName}/**`
}

export function isSkillDisabled(skill: SkillInfo, patterns: readonly string[]): boolean {
  const pattern = exclusionPattern(skill)
  return pattern !== null && patterns.includes(pattern)
}

function lastSegment(target: string): string | null {
  const parts = target.split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}
