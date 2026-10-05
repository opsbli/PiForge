import type { JSX, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 轻量 Markdown 渲染（零依赖）。
 *
 * 只覆盖对话场景的高频语法：标题、有序/无序列表、围栏代码块、
 * 行内代码、粗体、链接。不追求完整 CommonMark —— 若后续需要表格、
 * 嵌套列表等，再评估引入 react-markdown。
 *
 * 链接刻意渲染为不可点击的样式化文本：渲染进程尚未注册
 * window.open 处理策略，点击会由 Electron 默认行为新开窗口。
 */

type Block =
  | { kind: 'code'; lang: string; content: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; text: string }

const FENCE = /^```(\w*)\s*$/
const CLOSING_FENCE = /^```\s*$/
const HEADING = /^(#{1,4})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*\d+\.\s+(.*)$/

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    const fence = line.match(FENCE)
    if (fence) {
      const buffer: string[] = []
      index += 1
      while (index < lines.length && !CLOSING_FENCE.test(lines[index])) {
        buffer.push(lines[index])
        index += 1
      }
      index += 1 // 跳过结束围栏（缺失时越界，循环自然结束）
      blocks.push({ kind: 'code', lang: fence[1] ?? '', content: buffer.join('\n') })
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }

    const isOrdered = ORDERED.test(line)
    if (isOrdered || BULLET.test(line)) {
      const pattern = isOrdered ? ORDERED : BULLET
      const items: string[] = []
      while (index < lines.length) {
        const matched = lines[index].match(pattern)
        if (!matched) break
        items.push(matched[1])
        index += 1
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }

    if (!line.trim()) {
      index += 1
      continue
    }

    const buffer: string[] = []
    while (index < lines.length) {
      const current = lines[index]
      if (
        !current.trim() ||
        FENCE.test(current) ||
        HEADING.test(current) ||
        BULLET.test(current) ||
        ORDERED.test(current)
      ) {
        break
      }
      buffer.push(current)
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: buffer.join('\n') })
  }

  return blocks
}

const INLINE_PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let tokenIndex = 0
  let match: RegExpExecArray | null

  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    const token = match[0]
    const key = `${keyPrefix}-t${tokenIndex++}`

    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-accent px-1 py-0.5 font-mono text-[11px] text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      )
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      nodes.push(
        <span
          key={key}
          title={link?.[2]}
          className="text-info underline decoration-info/40 underline-offset-2"
        >
          {link?.[1] ?? token}
        </span>
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-base font-semibold',
  2: 'text-sm font-semibold',
  3: 'text-xs font-semibold',
  4: 'text-xs font-semibold text-muted-foreground'
}

export function MarkdownText({
  text,
  className
}: {
  text: string
  className?: string
}): JSX.Element {
  const blocks = parseBlocks(text)

  return (
    <div className={cn('flex flex-col gap-2 break-words', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`

        if (block.kind === 'code') {
          return (
            <div key={key} className="overflow-hidden rounded-md border border-border bg-background">
              {block.lang && (
                <div className="border-b border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {block.lang}
                </div>
              )}
              <pre className="max-h-80 overflow-auto p-2.5">
                <code className="font-mono text-[11px] leading-relaxed text-foreground">
                  {block.content}
                </code>
              </pre>
            </div>
          )
        }

        if (block.kind === 'heading') {
          return (
            <div key={key} className={cn('mt-1', HEADING_CLASS[block.level] ?? 'text-xs font-semibold')}>
              {renderInline(block.text, key)}
            </div>
          )
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag
              key={key}
              className={cn(
                'flex flex-col gap-1 pl-4 text-xs',
                block.ordered ? 'list-decimal' : 'list-disc'
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="leading-relaxed">
                  {renderInline(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          )
        }

        return (
          <p key={key} className="whitespace-pre-wrap text-xs leading-relaxed">
            {renderInline(block.text, key)}
          </p>
        )
      })}
    </div>
  )
}
