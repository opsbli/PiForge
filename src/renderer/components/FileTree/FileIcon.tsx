import type { JSX } from 'react'
import {
  Braces,
  FileCog,
  FileImage,
  FileText,
  FileCode,
  Folder,
  FolderOpen,
  Lock,
  ScrollText
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface IconSpec {
  icon: LucideIcon
  className: string
}

const DEFAULT_FILE: IconSpec = { icon: FileText, className: 'text-muted-foreground' }

/** 按扩展名映射图标与配色，未知类型回落到通用文件图标 */
const BY_EXTENSION: Record<string, IconSpec> = {
  ts: { icon: FileCode, className: 'text-info' },
  tsx: { icon: FileCode, className: 'text-info' },
  mts: { icon: FileCode, className: 'text-info' },
  js: { icon: FileCode, className: 'text-warning' },
  jsx: { icon: FileCode, className: 'text-warning' },
  mjs: { icon: FileCode, className: 'text-warning' },
  cjs: { icon: FileCode, className: 'text-warning' },
  json: { icon: Braces, className: 'text-warning' },
  css: { icon: FileCode, className: 'text-info' },
  scss: { icon: FileCode, className: 'text-info' },
  html: { icon: FileCode, className: 'text-destructive' },
  vue: { icon: FileCode, className: 'text-success' },
  yml: { icon: FileCog, className: 'text-success' },
  yaml: { icon: FileCog, className: 'text-success' },
  toml: { icon: FileCog, className: 'text-success' },
  md: { icon: ScrollText, className: 'text-muted-foreground' },
  mdx: { icon: ScrollText, className: 'text-muted-foreground' },
  png: { icon: FileImage, className: 'text-info' },
  jpg: { icon: FileImage, className: 'text-info' },
  jpeg: { icon: FileImage, className: 'text-info' },
  gif: { icon: FileImage, className: 'text-info' },
  webp: { icon: FileImage, className: 'text-info' },
  svg: { icon: FileImage, className: 'text-info' },
  ico: { icon: FileImage, className: 'text-info' },
  lock: { icon: Lock, className: 'text-muted-foreground' }
}

function specFor(name: string): IconSpec {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return BY_EXTENSION[ext] ?? DEFAULT_FILE
}

/** 文件类型图标 */
export function FileIcon({ name, className }: { name: string; className?: string }): JSX.Element {
  const spec = specFor(name)
  const Icon = spec.icon
  return <Icon className={cn('size-3.5 shrink-0', spec.className, className)} />
}

/** 目录图标（展开时用打开态） */
export function DirectoryIcon({ open, className }: { open: boolean; className?: string }): JSX.Element {
  const Icon = open ? FolderOpen : Folder
  return <Icon className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />
}
