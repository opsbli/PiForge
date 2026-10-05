import type { JSX } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@renderer/lib/utils'

/**
 * 对话区 Markdown 渲染（react-markdown + remark-gfm）。
 *
 * 元素样式全部映射到设计 token，不引入新的颜色来源。
 * 行内代码与围栏代码的区分、任务列表复选框的对齐放在 index.css 的
 * `.chat-markdown` 作用域里 —— 组件映射无法区分 `<code>` 是否位于 `<pre>` 内。
 *
 * 安全：react-markdown 默认转义原始 HTML（不经 rehype-raw），CSP 无需放宽；
 * 链接刻意渲染为不可点击的样式化文本，因为 main 进程未注册
 * window.open / will-navigate 处理策略，点击会由 Electron 默认行为接管。
 */

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-semibold text-foreground">{children}</h1>
  ),
  h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground">{children}</h2>,
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="text-xs leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-xs marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="flex flex-col gap-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-t border-border" />,
  table: ({ children, style }) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse" style={style}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-accent/40">{children}</thead>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-b border-border px-2 py-1 text-left text-[11px] font-medium text-foreground"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className="border-b border-border/60 px-2 py-1 align-top text-xs leading-relaxed"
    >
      {children}
    </td>
  ),
  pre: ({ node, children }) => {
    const language = languageOf(node)
    return (
      <div className="overflow-hidden rounded-md border border-border bg-background">
        {language && (
          <div className="border-b border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {language}
          </div>
        )}
        <pre className="max-h-96 overflow-auto p-2.5">{children}</pre>
      </div>
    )
  },
  a: ({ children, href }) => (
    <span title={href} className="text-info underline decoration-info/40 underline-offset-2">
      {children}
    </span>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
  img: ({ alt }) => (
    <span className="text-[11px] text-muted-foreground">[图片：{alt ?? '无描述'}]</span>
  )
}

export function MarkdownText({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <div className={cn('chat-markdown flex flex-col gap-2 break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** 从 `<pre>` 的 hast 节点里读出 `<code class="language-xxx">` 的语言名 */
function languageOf(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  const children = (node as { children?: unknown[] }).children
  const first = Array.isArray(children) ? children[0] : undefined
  if (!first || typeof first !== 'object') return undefined

  const properties = (first as { properties?: Record<string, unknown> }).properties
  const raw = properties?.className
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s+/) : []
  const match = list.find(
    (item): item is string => typeof item === 'string' && item.startsWith('language-')
  )

  return match ? match.slice('language-'.length) : undefined
}
