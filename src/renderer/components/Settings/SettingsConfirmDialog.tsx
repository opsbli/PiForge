import type { JSX } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@renderer/components/ui/dialog'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { readSettingsPath } from '@renderer/lib/settings-path'
import { NoticeBlock } from './SettingsLayout'

/**
 * 写入前的确认门。
 *
 * 逐条列出「字段 → 旧值 → 新值」与目标文件，并按 scope 说明后果——
 * 只问「是否继续」不足以让人判断，尤其是项目级配置会进入版本控制。
 */
export function SettingsConfirmDialog(): JSX.Element | null {
  const confirmOpen = useSettingsStore((s) => s.confirmOpen)
  const draft = useSettingsStore((s) => s.draft)
  const settings = useSettingsStore((s) => s.settings)
  const scope = useSettingsStore((s) => s.scope)
  const saving = useSettingsStore((s) => s.saving)
  const cancelSave = useSettingsStore((s) => s.cancelSave)
  const confirmSave = useSettingsStore((s) => s.confirmSave)

  const target =
    scope === 'global' ? settings?.paths.globalSettings : settings?.paths.projectSettings
  const entries = Object.entries(draft)

  return (
    <Dialog open={confirmOpen} onClose={saving ? () => undefined : cancelSave} className="max-w-2xl">
      <DialogHeader
        title="确认写入设置"
        description={`共 ${entries.length} 项 · 目标文件：${target ?? '（未就绪）'}`}
        icon={<TriangleAlert className="size-4 text-warning" />}
        onClose={saving ? undefined : cancelSave}
      />

      <DialogBody>
        <div className="flex flex-col divide-y divide-border">
          {entries.map(([key, value]) => {
            const previous = readSettingsPath(settings?.effective, key) ?? null
            return (
              <div key={key} className="flex items-start gap-3 py-1.5 text-[11px]">
                <span className="w-52 shrink-0 break-all font-mono text-muted-foreground">
                  {key}
                </span>
                <span className="min-w-0 flex-1 break-all">
                  <span className="text-muted-foreground line-through">{describe(previous)}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="text-foreground">
                    {value === null ? '删除该键（回到默认）' : describe(value)}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3">
          <NoticeBlock tone="warning">
            {scope === 'global'
              ? `写入用户级配置（agent 目录），对该用户下的所有项目生效。原文件会先备份为 .bak。`
              : `写入项目级 .pi/settings.json。该文件通常进入版本控制，其他人拉取后同样生效。原文件会先备份为 .bak。`}
          </NoticeBlock>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={cancelSave} disabled={saving}>
          取消
        </Button>
        <Button variant="default" onClick={() => void confirmSave()} disabled={saving}>
          {saving ? '写入中…' : '确认写入'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return '未设置'
  if (typeof value === 'boolean') return value ? '启用' : '关闭'
  if (Array.isArray(value)) return value.length === 0 ? '空数组' : value.join(', ')
  return String(value)
}
