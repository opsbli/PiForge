import { useRef, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 侧栏/面板拖拽手柄。
 * 只上报像素增量，由调用方决定是增宽还是收窄并自行夹取范围；
 * 双击可选复位到默认宽度。
 */
export function ResizeHandle({
  onDrag,
  onReset,
  className
}: {
  onDrag: (deltaX: number) => void
  onReset?: () => void
  className?: string
}): JSX.Element {
  const lastX = useRef<number | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    lastX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (lastX.current === null) return
    const delta = event.clientX - lastX.current
    lastX.current = event.clientX
    if (delta !== 0) onDrag(delta)
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>): void => {
    lastX.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      className={cn(
        'group/resize relative z-20 w-1 shrink-0 cursor-col-resize',
        'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2',
        'before:bg-border before:transition-colors hover:before:bg-ring',
        className
      )}
    />
  )
}
