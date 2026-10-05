/**
 * 危险操作判定（main / agent / renderer 共用）。
 *
 * 判定策略：危险命令清单（正则）+ 工作区路径校验。
 * 该模块是纯函数，不依赖 Electron，可在任何进程运行。
 */

export interface DangerVerdict {
  dangerous: boolean
  /** 命中原因（给人看） */
  reason?: string
  /** 命中的规则名（给日志/审计） */
  rule?: string
}

/** 危险 bash 命令模式 */
const DANGEROUS_BASH: Array<{ rule: string; re: RegExp; reason: string }> = [
  {
    rule: 'rm-root',
    re: /\brm\s+(-[a-zA-Z]*\s+)*(\/|~|\$HOME|\/\*)/,
    reason: '删除根目录 / 家目录'
  },
  {
    rule: 'rm-recursive-force',
    re: /\brm\s+-[a-zA-Z]*(rf|fr)[a-zA-Z]*\b/,
    reason: '递归强制删除（rm -rf）'
  },
  { rule: 'dd-device', re: /\bdd\b[^\n]*\bof=\/dev\//, reason: '写入块设备（dd of=/dev/...）' },
  { rule: 'mkfs', re: /\bmkfs(\.\w+)?\b/, reason: '格式化文件系统' },
  { rule: 'disk-partition', re: /\b(fdisk|parted|diskutil)\b/, reason: '磁盘分区操作' },
  { rule: 'power', re: /\b(shutdown|reboot|halt|poweroff)\b/, reason: '关机 / 重启' },
  { rule: 'fork-bomb', re: /:\(\)\s*\{.*?\}\s*;\s*:/, reason: 'fork 炸弹' },
  { rule: 'redirect-device', re: />\s*\/dev\/(sd|hd|nvme|disk)/, reason: '重定向到块设备' },
  { rule: 'chmod-root', re: /\bchmod\s+-R\s+[0-7]{3,4}\s+\/(\s|$)/, reason: '递归修改根目录权限' },
  { rule: 'chown-root', re: /\bchown\s+-R\b[^\n]*\s\/(\s|$)/, reason: '递归修改根目录属主' },
  { rule: 'force-push', re: /\bgit\s+push\b[^\n]*--force\b/, reason: '强制推送（可能覆盖远端历史）' },
  { rule: 'pipe-to-shell', re: /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba|z|k)?sh\b/, reason: '管道执行远程脚本' },
  { rule: 'credential-read', re: /\b(cat|less|more|head|tail)\b[^\n]*(\.ssh\/id_|\.aws\/credentials|\/etc\/shadow)/, reason: '读取凭据文件' }
]

/** 需要审批的高危工具（非 bash） */
const SENSITIVE_TOOLS = new Set(['write', 'edit'])

/** 判定一条 bash 命令是否危险 */
export function checkBashCommand(command: string): DangerVerdict {
  for (const { rule, re, reason } of DANGEROUS_BASH) {
    if (re.test(command)) return { dangerous: true, reason, rule }
  }
  return { dangerous: false }
}

/** 判断 targetPath 是否落在工作区内（防止越界写文件） */
export function isInsideWorkspace(targetPath: string, workspace: string): boolean {
  const normalize = (p: string): string =>
    p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const ws = normalize(workspace)
  const target = normalize(targetPath)
  // 相对路径按工作区内处理
  if (!target.startsWith('/') && !/^[a-z]:/.test(target)) return true
  return target === ws || target.startsWith(`${ws}/`)
}

/**
 * 综合判定一次工具调用是否需要用户审批。
 * @param toolName SDK 工具名（bash / write / edit / read ...）
 * @param input    工具入参
 * @param workspace 授权工作区（绝对路径）
 */
export function assessToolCall(
  toolName: string,
  input: unknown,
  workspace: string
): DangerVerdict {
  const args = (input ?? {}) as Record<string, unknown>

  if (toolName === 'bash' || toolName === 'powershell') {
    const command = String(args.command ?? '')
    return checkBashCommand(command)
  }

  if (SENSITIVE_TOOLS.has(toolName)) {
    const target = String(args.path ?? '')
    if (target && !isInsideWorkspace(target, workspace)) {
      return {
        dangerous: true,
        rule: 'workspace-escape',
        reason: `写入工作区之外的路径：${target}`
      }
    }
  }

  return { dangerous: false }
}
