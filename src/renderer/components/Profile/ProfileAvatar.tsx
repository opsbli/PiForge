import type { JSX } from 'react'
import { User } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/**
 * 个人头像展示。
 * 已设置时渲染图片；未设置时用内置图标兜底（与「未设置使用默认头像」一致）。
 */
export function ProfileAvatar({
  avatarDataUrl,
  className
}: {
  avatarDataUrl: string | null
  className?: string
}): JSX.Element {
  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt="头像"
        className={cn('size-5 shrink-0 rounded-md object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-muted-foreground',
        className
      )}
    >
      <User className="size-3.5" />
    </span>
  )
}
