import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText } from 'lucide-react'
import { MARKDOWN_COMPONENTS } from '@renderer/components/Chat/MarkdownText'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'

/**
 * 编辑器 Markdown 预览（只读）。
 *
 * 元素渲染复用对话区的 MARKDOWN_COMPONENTS，排版由外层作用域类区分：
 * `.chat-markdown` 提供代码块、任务列表复选框等共享规则，`.md-preview`
 * 在此基础上放大标题与正文字号，使其接近文档阅读而非对话气泡。
 *
 * 安全边界与对话区一致：react-markdown 默认转义原始 HTML（不经 rehype-raw），
 * 链接仍是不可点击的样式化文本，图片渲染为占位文本 —— main 进程未注册
 * window.open / will-navigate 策略，也没有可加载本地图片的自定义协议，
 * 直接放行会落回 Electron 默认行为。
 */
export function MarkdownPreview({
  text,
  className
}: {
  text: string
  className?: string
}): JSX.Element {
  if (!text.trim()) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          文件为空，切换到编辑模式开始撰写
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <article className="chat-markdown md-preview mx-auto flex w-full max-w-3xl flex-col gap-3 break-words px-6 py-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {text}
        </ReactMarkdown>
      </article>
    </ScrollArea>
  )
}
