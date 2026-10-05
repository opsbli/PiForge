import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import * as monaco from 'monaco-editor'
import { Check, Eye, PenLine, Save } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Segmented, type SegmentedOption } from '@renderer/components/ui/segmented'
import { MarkdownPreview } from '@renderer/components/Editor/MarkdownPreview'
import { useThemeStore } from '@renderer/stores/theme-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { cn } from '@renderer/lib/utils'

/** 编辑器显示模式：Markdown 文档默认进预览，其余文件固定为编辑 */
type EditorMode = 'preview' | 'edit'

const MODE_OPTIONS: SegmentedOption<EditorMode>[] = [
  { value: 'preview', label: '预览', icon: Eye },
  { value: 'edit', label: '编辑', icon: PenLine }
]

/** Monaco 编辑器：查看/编辑/保存工作区文件；Markdown 支持预览与编辑切换 */
export function Editor({ active = true }: { active?: boolean }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const dirty = useWorkspaceStore((s) => s.dirty)
  const markSaved = useWorkspaceStore((s) => s.markSaved)
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [mode, setMode] = useState<EditorMode>('edit')

  const markdown = isMarkdownPath(openFilePath)
  const previewing = markdown && mode === 'preview'

  /** 保存当前文件（从 store 读最新内容，避免闭包过期） */
  const save = useCallback(async (): Promise<void> => {
    const state = useWorkspaceStore.getState()
    if (!state.openFilePath) {
      setFeedback('没有打开的文件')
      return
    }
    try {
      await window.piforge.writeFile(state.openFilePath, state.content)
      markSaved()
      setFeedback('已保存')
      window.setTimeout(() => setFeedback(null), 2000)
    } catch (err) {
      setFeedback(`保存失败：${String(err)}`)
    }
  }, [markSaved])

  // 初始化编辑器（只一次）
  useEffect(() => {
    if (!containerRef.current) return
    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 10 }
    })
    editorRef.current = editor

    // 内容变化 → store 标记 dirty
    const sub = editor.onDidChangeModelContent(() => {
      if (editor.getValue() !== useWorkspaceStore.getState().content) {
        useWorkspaceStore.getState().setContent(editor.getValue())
      }
    })

    // Ctrl/Cmd+S 保存
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void save()
    })

    return () => {
      sub.dispose()
      editor.dispose()
      editorRef.current = null
    }
  }, [save])

  // 主题跟随（Monaco 主题是全局的，与视图是否可见无关）
  useEffect(() => {
    monaco.editor.setTheme(resolvedTheme === 'dark' ? 'vs-dark' : 'vs')
  }, [resolvedTheme])

  // 视图从隐藏切回可见时，容器尺寸刚恢复，需要重新布局
  useEffect(() => {
    if (!active) return
    const id = window.requestAnimationFrame(() => editorRef.current?.layout())
    return () => window.cancelAnimationFrame(id)
  }, [active])

  // 从预览切回编辑：Monaco 容器此前被 visibility 隐藏，主动布局一次以保证尺寸正确
  useEffect(() => {
    if (previewing) return
    const id = window.requestAnimationFrame(() => editorRef.current?.layout())
    return () => window.cancelAnimationFrame(id)
  }, [previewing])

  // 窗口级 Ctrl/Cmd+S（编辑器未聚焦时也生效）
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  // 切换文件时更新内容与语言，并按文件类型重置显示模式（Markdown 默认预览）
  useEffect(() => {
    setMode(isMarkdownPath(openFilePath) ? 'preview' : 'edit')

    const editor = editorRef.current
    if (!editor) return
    const state = useWorkspaceStore.getState()
    if (openFilePath) {
      editor.setValue(state.content)
      const model = editor.getModel()
      if (model) monaco.editor.setModelLanguage(model, languageOf(openFilePath))
    } else {
      editor.setValue('')
    }
  }, [openFilePath])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground"
          title={openFilePath ?? ''}
        >
          {openFilePath ?? '未打开文件（从右侧文件面板选择一个文件）'}
          {dirty && <span className="ml-1.5 text-warning">• 未保存</span>}
        </span>

        {feedback && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-success">
            <Check className="size-3" />
            {feedback}
          </span>
        )}

        {markdown && (
          <Segmented
            value={mode}
            onValueChange={setMode}
            options={MODE_OPTIONS}
            className="shrink-0"
          />
        )}

        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!openFilePath || !dirty}
          title="保存（Ctrl+S）"
          onClick={() => void save()}
        >
          <Save />
          保存
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Monaco 容器保持挂载：卸载会销毁编辑器实例与撤销栈，隐藏时改可见性即可 */}
        <div ref={containerRef} className={cn('absolute inset-0', previewing && 'invisible')} />
        {previewing && <MarkdownPreviewPane />}
      </div>
    </div>
  )
}

/** 预览窗格：独立订阅编辑器内容，避免编辑模式下每次键入都触发 Editor 重渲染 */
function MarkdownPreviewPane(): JSX.Element {
  const content = useWorkspaceStore((s) => s.content)
  return <MarkdownPreview text={content} className="absolute inset-0" />
}

/** Markdown 文档判定：只有这类文件提供预览模式 */
function isMarkdownPath(path: string | null): boolean {
  if (!path) return false
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'md' || ext === 'markdown'
}

function languageOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
    rs: 'rust',
    go: 'go',
    sh: 'shell'
  }
  return map[ext] ?? 'plaintext'
}
