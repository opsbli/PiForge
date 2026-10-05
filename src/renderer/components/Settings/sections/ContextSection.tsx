import type { JSX } from 'react'
import { SettingsFieldRow } from '../SettingsFieldRow'
import { NoticeBlock, SectionShell, SettingsGroup } from '../SettingsLayout'

/** 会话与上下文：压缩、分支摘要、会话目录、网络与重试、消息投递 */
export function ContextSection(): JSX.Element {
  return (
    <SectionShell
      title="会话与上下文"
      description="上下文压缩、分支摘要与网络重试策略。带「生效值」的行会显示未显式设置时的内置默认。"
    >
      <SettingsGroup
        title="上下文压缩"
        description="compaction：接近上下文上限时自动摘要较早内容。"
      >
        <SettingsFieldRow
          fieldKey="compaction.enabled"
          label="启用自动压缩"
          hint="保存后立即生效"
        />
        <SettingsFieldRow
          fieldKey="compaction.reserveTokens"
          label="预留 token"
          hint="为模型回复预留，不参与摘要"
        />
        <SettingsFieldRow
          fieldKey="compaction.keepRecentTokens"
          label="保留最近 token"
          hint="这段最近内容不做摘要"
        />
      </SettingsGroup>

      <SettingsGroup title="分支摘要" description="branchSummary：切分支时对被放弃分支的归纳。">
        <SettingsFieldRow fieldKey="branchSummary.reserveTokens" label="预留 token" />
        <SettingsFieldRow
          fieldKey="branchSummary.skipPrompt"
          label="跳过摘要提示"
          hint="开启后不做摘要，直接切分支"
        />
      </SettingsGroup>

      <SettingsGroup title="会话存储">
        <SettingsFieldRow
          fieldKey="sessionDir"
          label="sessionDir"
          hint="会话文件目录；留空回到 agent 目录下的默认位置"
        />
      </SettingsGroup>

      <SettingsGroup title="网络与重试">
        <SettingsFieldRow
          fieldKey="transport"
          label="传输方式"
          hint="transport"
          enumLabels={{
            auto: 'auto（自动）',
            sse: 'sse',
            websocket: 'websocket',
            'websocket-cached': 'websocket-cached'
          }}
        />
        <SettingsFieldRow
          fieldKey="httpProxy"
          label="HTTP 代理"
          hint="httpProxy；只能写在用户级配置"
        />
        <SettingsFieldRow fieldKey="httpIdleTimeoutMs" label="HTTP 空闲超时（毫秒）" />
        <SettingsFieldRow fieldKey="retry.enabled" label="自动重试" hint="保存后立即生效" />
        <SettingsFieldRow fieldKey="retry.maxRetries" label="最大重试次数" />
        <SettingsFieldRow fieldKey="retry.baseDelayMs" label="初始退避延迟（毫秒）" />
      </SettingsGroup>

      <SettingsGroup title="消息投递">
        <SettingsFieldRow
          fieldKey="steeringMode"
          label="steeringMode"
          hint="排队中的纠偏消息如何投递，保存后立即生效"
          enumLabels={{ all: 'all（全部投递）', 'one-at-a-time': 'one-at-a-time（逐条投递）' }}
        />
        <SettingsFieldRow
          fieldKey="followUpMode"
          label="followUpMode"
          hint="排队中的后续消息如何投递，保存后立即生效"
          enumLabels={{ all: 'all（全部投递）', 'one-at-a-time': 'one-at-a-time（逐条投递）' }}
        />
      </SettingsGroup>

      <SettingsGroup title="Shell">
        <SettingsFieldRow
          fieldKey="shellPath"
          label="shellPath"
          hint="自定义 shell 可执行文件路径，支持开头的 ~"
        />
        <SettingsFieldRow
          fieldKey="shellCommandPrefix"
          label="shellCommandPrefix"
          hint="会拼接到每条 shell 命令之前"
        />
        <SettingsFieldRow
          fieldKey="npmCommand"
          label="npmCommand"
          hint="npm 包查询与安装使用的命令"
        />
      </SettingsGroup>

      <NoticeBlock>
        所有数值都必须是安全整数。带「改后需重载」提示的行，保存后右上角会出现「立即重载」。
      </NoticeBlock>
    </SectionShell>
  )
}
