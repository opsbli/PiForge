import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import * as monaco from 'monaco-editor'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

/** Monaco 编辑器：查看/编辑/保存工作区文件 */
export function Editor(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const dirty = useWorkspaceStore((s) => s.dirty)
  const markSaved = useWorkspaceStore((s) => s.markSaved)
  const [feedback, setFeedback] = useState<string | null>(null)

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
      scrollBeyondLastLine: false
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

  // 窗口级 Ctrl/Cmd+S（编辑器未聚焦时也生效）
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  // 切换文件时更新内容与语言
  useEffect(() => {
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
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="truncate text-xs text-muted-foreground">
          {openFilePath ?? '未打开文件（点击左侧文件打开）'}
          {dirty ? ' •未保存' : ''}
        </span>
        <div className="flex items-center gap-2">
          {feedback && <span className="text-xs text-emerald-400">{feedback}</span>}
          <button
            className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
            disabled={!openFilePath}
            onClick={() => void save()}
            title="保存（Ctrl+S）"
          >
            保存
          </button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  )
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
