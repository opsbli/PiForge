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

/** 会话与上下文：压缩、分支摘要、会话目录、网络与重试 */
export function ContextSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const resolved = settings?.resolved

  return (
    <SectionShell
      title="会话与上下文"
      description="上下文压缩、分支摘要与网络重试策略。所有数值均为生效值（含 SDK 内置默认）。"
    >
      <SettingsGroup
        title="上下文压缩"
        description="compaction：接近上下文上限时自动摘要较早内容。"
      >
        <SettingsRow label="启用自动压缩">
          <ValueText value={resolved?.compactionEnabled} />
        </SettingsRow>
        <SettingsRow label="预留 token" hint="为模型回复预留，不参与摘要">
          <ValueText value={resolved?.compactionReserveTokens} />
        </SettingsRow>
        <SettingsRow label="保留最近 token" hint="这段最近内容不做摘要">
          <ValueText value={resolved?.compactionKeepRecentTokens} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="分支摘要" description="branchSummary：切分支时对被放弃分支的归纳。">
        <SettingsRow label="预留 token">
          <ValueText value={resolved?.branchSummaryReserveTokens} />
        </SettingsRow>
        <SettingsRow label="跳过摘要提示" hint="开启后不做摘要，直接切分支">
          <ValueText value={resolved?.branchSummarySkipPrompt} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="会话存储">
        <SettingsRow label="sessionDir" hint="会话文件目录；未设置时使用 agent 目录下的默认位置">
          <ValueText value={resolved?.sessionDir} mono />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="网络与重试">
        <SettingsRow label="传输方式" hint="transport">
          <ValueText value={resolved?.transport} />
        </SettingsRow>
        <SettingsRow label="HTTP 代理" hint="httpProxy；仅能写在 agent 目录的用户级配置里">
          <ValueText value={resolved?.httpProxy} mono />
        </SettingsRow>
        <SettingsRow label="HTTP 空闲超时">
          <ValueText value={resolved?.httpIdleTimeoutMs} />
        </SettingsRow>
        <SettingsRow label="自动重试">
          <ValueText value={resolved?.retryEnabled} />
        </SettingsRow>
        <SettingsRow label="最大重试次数">
          <ValueText value={resolved?.retryMaxRetries} />
        </SettingsRow>
        <SettingsRow label="初始退避延迟">
          <ValueText value={resolved?.retryBaseDelayMs} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="消息投递">
        <SettingsRow label="steeringMode" hint="排队中的纠偏消息如何投递">
          <ValueText value={resolved?.steeringMode} />
        </SettingsRow>
        <SettingsRow label="followUpMode" hint="排队中的后续消息如何投递">
          <ValueText value={resolved?.followUpMode} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="其余相关项">
        <SettingsRow label="shellPath">
          <ValueText value={resolved?.shellPath} mono />
        </SettingsRow>
        <SettingsRow label="shellCommandPrefix">
          <ValueText value={resolved?.shellCommandPrefix} mono />
        </SettingsRow>
        <SettingsRow label="npmCommand">
          {resolved?.npmCommand && resolved.npmCommand.length > 0 ? (
            <ChipList items={resolved.npmCommand} />
          ) : (
            <ValueText value={null} />
          )}
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock>
        本分类本轮只读。压缩与重试开关有对应的 live setter，P2 起可在保存后立即生效。
      </NoticeBlock>
    </SectionShell>
  )
}
