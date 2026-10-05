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

/** 项目与信任：受保护资源、已保存的信任决定与默认策略 */
export function TrustSection(): JSX.Element {
  const trust = useSettingsStore((s) => s.trust)

  const decisionLabel =
    trust?.decision === null || trust?.decision === undefined
      ? '无已保存的决定'
      : trust.decision
        ? '已信任'
        : '已拒绝'

  return (
    <SectionShell
      title="项目与信任"
      description="项目信任决定工作目录下的 .pi 配置与可执行资源是否加载。它不是沙箱，不限制工具能访问的内容。"
    >
      <SettingsGroup title="当前项目">
        <SettingsRow label="工作目录">
          <ValueText value={trust?.cwd} mono />
        </SettingsRow>
        <SettingsRow
          label="是否需要信任决定"
          hint="探测到受保护的项目资源时为「是」"
        >
          <ValueText value={trust?.requiresTrust} />
        </SettingsRow>
        <SettingsRow label="运行中的加载器" hint="当前 agent 会话是按已信任还是未信任加载">
          <ValueText value={trust ? (trust.loaderTrusted ? '已信任' : '未信任') : null} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="已保存的决定" description="保存在 agent 目录的 trust.json，按规范化目录路径记录。">
        <SettingsRow label="当前目录的决定">
          <ValueText value={decisionLabel} />
        </SettingsRow>
        <SettingsRow label="trust.json">
          <ValueText value={trust?.savedPath} mono />
        </SettingsRow>
        <SettingsRow
          label="defaultProjectTrust"
          hint="没有已保存决定、也没有扩展介入时采用；CLI 等的默认是 ask"
        >
          <ValueText value={trust?.defaultProjectTrust} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="探测到的受保护资源">
        <SettingsRow label="清单" hint="这些资源会触发信任要求">
          <ChipList items={trust?.protectedResources ?? []} empty="未探测到" />
        </SettingsRow>
      </SettingsGroup>

      <NoticeBlock tone="warning">
        信任一个目录等同于允许其中的扩展与 MCP 配置自动加载并执行。本分类本轮只读，
        写入 / 清除信任决定将在 P5 开放，届时会先说明上述后果并要求确认。
      </NoticeBlock>
    </SectionShell>
  )
}
