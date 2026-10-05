import type { JSX } from 'react'
import { SandboxSettings } from '@renderer/components/Sandbox/SandboxSettings'
import { NoticeBlock, SectionShell, SettingsGroup } from '../SettingsLayout'

/** 沙箱：执行模型生成代码与 shell 命令时的隔离模式 */
export function SandboxSection(): JSX.Element {
  return (
    <SectionShell
      title="沙箱"
      description="执行沙箱用于运行模型生成的代码与 shell 命令。默认使用本地受限子进程；Docker 模式提供容器隔离并拒绝网络。"
    >
      <SettingsGroup title="执行沙箱">
        <SandboxSettings />
      </SettingsGroup>

      <NoticeBlock>
        沙箱模式切换即时生效，不需要重载 agent。Docker 模式需要本机 Docker CLI 与守护进程可用。
      </NoticeBlock>
    </SectionShell>
  )
}
