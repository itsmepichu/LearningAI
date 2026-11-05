/** The critical path through a request: parallel spans count only by their slowest. Pure. */
export interface Timings {
  rewrite: number
  bm25: number
  vector: number
  rerank: number
  model1: number
  tool: number
  model2: number
  /** The tool times out once and is retried. */
  toolRetry: boolean
}
export type PathKind = 'retrieval' | 'model' | 'tool' | 'timeout'
export interface PathSpan {
  name: string
  start: number
  duration: number
  critical: boolean
  kind: PathKind
  parallel?: boolean
}

export const TOOL_TIMEOUT_MS = 2000
export const DEFAULTS: Timings = { rewrite: 400, bm25: 40, vector: 60, rerank: 800, model1: 850, tool: 240, model2: 2900, toolRetry: false }

export function criticalPath(t: Timings, toolName = 'tool call') {
  const spans: PathSpan[] = []
  let at = 0
  const add = (name: string, duration: number, kind: PathKind) => {
    spans.push({ name, start: at, duration, critical: true, kind })
    at += duration
  }
  add('query rewrite', t.rewrite, 'model')
  // BM25 and vector search run side by side, so only the slower one is on the path. BM25 wins a tie.
  spans.push({ name: 'BM25', start: at, duration: t.bm25, critical: t.bm25 >= t.vector, kind: 'retrieval', parallel: true })
  spans.push({ name: 'vector search', start: at, duration: t.vector, critical: t.vector > t.bm25, kind: 'retrieval', parallel: true })
  at += Math.max(t.bm25, t.vector)
  add('rerank', t.rerank, 'retrieval')
  add('model call 1 (tool request)', t.model1, 'model')
  if (t.toolRetry) {
    add(`${toolName} → timeout`, TOOL_TIMEOUT_MS, 'timeout')
    add(`${toolName} (retry)`, t.tool, 'tool')
  } else {
    add(toolName, t.tool, 'tool')
  }
  add('model call 2 (answer)', t.model2, 'model')
  const longest = spans.filter((s) => s.critical).reduce((a, b) => (b.duration > a.duration ? b : a))
  return {
    spans,
    total: at,
    longest,
    offPath: t.bm25 >= t.vector ? 'vector search' : 'BM25',
  }
}
