import type { JSX } from 'react'
import { FolderOpen } from 'lucide-react'
import { FileIcon } from '@renderer/components/FileTree/FileIcon'

/**
 * `<read-files>` 块的渲染。
 *
 * 这是 agent 归纳会话时写入的约定标记（与 Proma 侧一致），语义是「本次读取过这些文件」。
 * react-markdown 默认会把原始 HTML 转义成字面文本，导致标签连同文件清单挤成一段
 * 行内文字，因此由 MarkdownText 在渲染前把它切分出来单独处理。
 *
 * 只做展示：文件是工作区相对路径，点击打开需要与工作区拼接后再走 IPC，本轮未接入。
 */
export function ReadFilesBlock({ files }: { files: string[] }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/40">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <FolderOpen className="size-3" />
        已读取 {files.length} 个文件
      </div>
      <ul className="flex flex-col gap-0.5 p-1.5">
        {files.map((file) => (
          <li key={file} className="flex items-center gap-1.5 px-1 py-0.5">
            <FileIcon name={file} />
            <span
              title={file}
              className="min-w-0 truncate font-mono text-[11px] text-muted-foreground"
            >
              {file}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
