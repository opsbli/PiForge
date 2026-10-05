import { useEffect, useRef, type JSX } from 'react'
import * as monaco from 'monaco-editor'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

/** Monaco 编辑器：查看/编辑工作区文件 */
export function Editor(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const openFilePath = useWorkspaceStore((s) => s.openFilePath)
  const dirty = useWorkspaceStore((s) => s.dirty)

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

    return () => {
      sub.dispose()
      editor.dispose()
      editorRef.current = null
    }
  }, [])

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
          {openFilePath ?? '未打开文件'}
          {dirty ? ' •' : ''}
        </span>
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
