import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'

/**
 * 本地可观测性存储（阶段十三）。
 *
 * 全本地执行栈：Electron + SQLite（WAL 模式支持并发读写），无云端依赖。
 * 数据模型：一次 Agent 运行 = 一个 trace，包含多个 span（user / llm / tool）。
 */

export interface TraceRow {
  id: string
  session_id: string
  started_at: number
  ended_at: number | null
  model: string
  status: string
  user_prompt: string
  input_tokens: number
  output_tokens: number
  cost: number
}

export interface SpanRow {
  id: string
  trace_id: string
  type: 'user' | 'llm' | 'tool'
  name: string
  started_at: number
  duration_ms: number
  input: string
  output: string
  input_tokens: number
  output_tokens: number
  cost: number
  error: string | null
}

let db: Database.Database | null = null

/** 打开（或创建）trace 数据库 */
export function openTraceStore(): Database.Database {
  if (db) return db
  const path = join(app.getPath('userData'), 'traces.db')
  db = new Database(path)
  db.pragma('journal_mode = WAL') // 并发读写
  db.pragma('synchronous = NORMAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      user_prompt TEXT NOT NULL DEFAULT '',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      input TEXT NOT NULL DEFAULT '',
      output TEXT NOT NULL DEFAULT '',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY (trace_id) REFERENCES traces(id)
    );
    CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
    CREATE INDEX IF NOT EXISTS idx_traces_started ON traces(started_at DESC);
  `)
  return db
}

export function closeTraceStore(): void {
  db?.close()
  db = null
}

let traceSeq = 0
let currentTraceId: string | null = null
let currentSpanStart = 0

/** 开始一次 trace（用户发送 prompt 时） */
export function beginTrace(sessionId: string, model: string, userPrompt: string): string {
  const d = openTraceStore()
  const id = `trace-${Date.now()}-${++traceSeq}`
  d.prepare(
    `INSERT INTO traces (id, session_id, started_at, model, status, user_prompt)
     VALUES (?, ?, ?, ?, 'running', ?)`
  ).run(id, sessionId, Date.now(), model, userPrompt)
  // 记录 user span
  d.prepare(
    `INSERT INTO spans (id, trace_id, type, name, started_at, input)
     VALUES (?, ?, 'user', 'prompt', ?, ?)`
  ).run(`${id}-user`, id, Date.now(), userPrompt)
  currentTraceId = id
  return id
}

/** 记录 LLM 调用的开始 */
export function beginLlmSpan(): void {
  currentSpanStart = Date.now()
}

/** 结束 LLM 调用（写入 token / cost） */
export function endLlmSpan(tokens: { input: number; output: number; cost: number }): void {
  if (!currentTraceId) return
  const d = openTraceStore()
  const duration = Date.now() - currentSpanStart
  d.prepare(
    `INSERT INTO spans (id, trace_id, type, name, started_at, duration_ms, input_tokens, output_tokens, cost)
     VALUES (?, ?, 'llm', 'completion', ?, ?, ?, ?, ?)`
  ).run(
    `${currentTraceId}-llm-${Date.now()}`,
    currentTraceId,
    currentSpanStart,
    duration,
    tokens.input,
    tokens.output,
    tokens.cost
  )
  d.prepare(
    `UPDATE traces SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, cost = cost + ?
     WHERE id = ?`
  ).run(tokens.input, tokens.output, tokens.cost, currentTraceId)
}

/** 记录一次工具调用 span */
export function recordToolSpan(
  callId: string,
  tool: string,
  args: unknown,
  result: unknown,
  ok: boolean,
  error?: string
): void {
  if (!currentTraceId) return
  const d = openTraceStore()
  d.prepare(
    `INSERT OR REPLACE INTO spans (id, trace_id, type, name, started_at, duration_ms, input, output, error)
     VALUES (?, ?, 'tool', ?, ?, 0, ?, ?, ?)`
  ).run(
    callId,
    currentTraceId,
    tool,
    Date.now(),
    safeJson(args),
    safeJson(result),
    ok ? null : (error ?? 'tool failed')
  )
}

/** 结束当前 trace */
export function endTrace(status = 'ok'): void {
  if (!currentTraceId) return
  const d = openTraceStore()
  d.prepare(`UPDATE traces SET ended_at = ?, status = ? WHERE id = ?`).run(
    Date.now(),
    status,
    currentTraceId
  )
  currentTraceId = null
}

/** 最新 trace 列表 */
export function listTraces(limit = 50): TraceRow[] {
  const d = openTraceStore()
  return d
    .prepare(`SELECT * FROM traces ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as TraceRow[]
}

/** 某次 trace 的全部 span */
export function listSpans(traceId: string): SpanRow[] {
  const d = openTraceStore()
  return d
    .prepare(`SELECT * FROM spans WHERE trace_id = ? ORDER BY started_at ASC`)
    .all(traceId) as SpanRow[]
}

/** 汇总统计 */
export function getStats(): {
  traceCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  toolCallCount: number
} {
  const d = openTraceStore()
  const t = d
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(input_tokens),0) AS i,
              COALESCE(SUM(output_tokens),0) AS o, COALESCE(SUM(cost),0) AS cost
       FROM traces`
    )
    .get() as { c: number; i: number; o: number; cost: number }
  const s = d.prepare(`SELECT COUNT(*) AS c FROM spans WHERE type = 'tool'`).get() as { c: number }
  return {
    traceCount: t.c,
    totalInputTokens: t.i,
    totalOutputTokens: t.o,
    totalCost: t.cost,
    toolCallCount: s.c
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null).slice(0, 4000)
  } catch {
    return String(value).slice(0, 4000)
  }
}
