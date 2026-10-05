import { useEffect, useRef, type JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/** 本地终端（xterm.js + node-pty），cwd 为当前工作区 */
export function TerminalPanel(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const termIdRef = useRef<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, Consolas, monospace',
      theme: { background: '#0a0a0a' },
      cursorBlink: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    try {
      fit.fit()
    } catch {
      // 容器尺寸未就绪时忽略
    }
    termRef.current = term

    let offData: (() => void) | null = null
    let offExit: (() => void) | null = null

    void (async () => {
      try {
        const id = await window.piforge.createTerminal()
        termIdRef.current = id

        offData = window.piforge.onTerminalData((event) => {
          if (event.terminalId === id) term.write(event.data)
        })
        offExit = window.piforge.onTerminalExit((event) => {
          if (event.terminalId === id) term.write('\r\n[进程已退出]\r\n')
        })

        term.onData((data) => {
          void window.piforge.sendTerminalInput(id, data)
        })
        term.onResize(({ cols, rows }) => {
          void window.piforge.resizeTerminal(id, cols, rows)
        })

        // 初次适配后再告知后端尺寸
        setTimeout(() => {
          try {
            fit.fit()
            void window.piforge.resizeTerminal(id, term.cols, term.rows)
          } catch {
            // 忽略
          }
        }, 50)
      } catch (err) {
        term.write(`\r\n[终端创建失败] ${String(err)}\r\n`)
      }
    })()

    const onResize = (): void => {
      try {
        fit.fit()
      } catch {
        // 忽略
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      offData?.()
      offExit?.()
      term.dispose()
      if (termIdRef.current) void window.piforge.killTerminal(termIdRef.current)
      termRef.current = null
      termIdRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full overflow-hidden p-1" />
}
