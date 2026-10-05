import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, JSX } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 基础按钮。所有可点击操作的统一样式来源。
 * variant 表达语义层级，size 表达密度；图标尺寸由 size 统一注入。
 */
export const buttonVariants = cva(
  [
    'app-no-drag',
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md',
    'text-xs font-medium transition-colors',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-40',
    '[&_svg]:shrink-0'
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        subtle: 'bg-accent text-accent-foreground hover:bg-accent/70',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        sm: 'h-6 px-2 [&_svg]:size-3.5',
        md: 'h-7 px-2.5 [&_svg]:size-4',
        lg: 'h-9 px-4 text-sm [&_svg]:size-4',
        icon: 'size-7 [&_svg]:size-4',
        'icon-sm': 'size-6 [&_svg]:size-3.5'
      }
    },
    defaultVariants: { variant: 'ghost', size: 'md' }
  }
)

export interface ButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
