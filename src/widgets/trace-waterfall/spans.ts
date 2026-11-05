/** One example trace of a RAG request with a tool call, with illustrative timings. Pure. */
import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadSagaRef } from '../saga/scenarios.ts'

export type SpanKind = 'model' | 'tool' | 'retrieval' | 'other'
export interface Span {
  name: string
  start: number
  duration: number
  depth: number
  kind: SpanKind
  attributes: Record<string, string | number | boolean>
}

const TOOLS: Record<ProjectId, { tool: string; param: string }> = {
  harbor: { tool: 'get_ticket', param: 'ticket_id' },
  store: { tool: 'get_order', param: 'order_id' },
  bank: { tool: 'get_case', param: 'case_id' },
  travel: { tool: 'get_booking', param: 'booking_id' },
}

export const TRACE_MS = 5400

export function traceSpans(p: Pick<Project, 'id' | 'company'>, ref: string): Span[] {
  const { tool, param } = TOOLS[p.id]
  const tenant = p.company.toLowerCase().replace(/\s+/g, '-')
  return [
    { name: 'rag.request', start: 0, duration: TRACE_MS, depth: 0, kind: 'other', attributes: { tenant, 'prompt.version': 'answer@v12', release: 'r2026.11.3' } },
    { name: 'gateway.auth', start: 5, duration: 18, depth: 1, kind: 'other', attributes: { 'enduser.id': 'u_9c1e (hashed)', 'quota.remaining_tpm': 381200 } },
    { name: 'chat small-2026-05 (query rewrite)', start: 25, duration: 410, depth: 1, kind: 'model', attributes: { 'gen_ai.operation.name': 'chat', 'gen_ai.request.model': 'small-2026-05', 'gen_ai.usage.input_tokens': 620, 'gen_ai.usage.output_tokens': 24 } },
    { name: 'retrieval.search', start: 440, duration: 95, depth: 1, kind: 'retrieval', attributes: { 'retrieval.k': 100, filter: `tenant=${tenant} AND acl∩groups` } },
    { name: 'bm25', start: 445, duration: 40, depth: 2, kind: 'retrieval', attributes: { hits: 100 } },
    { name: 'vector.hnsw', start: 445, duration: 62, depth: 2, kind: 'retrieval', attributes: { efSearch: 64, index: 'kb-v4' } },
    { name: 'retrieval.rerank', start: 540, duration: 820, depth: 1, kind: 'retrieval', attributes: { candidates: 50, kept: 8, model: 'reranker-base', queue_wait_ms: 610 } },
    { name: 'chat large-2026-09', start: 1370, duration: 840, depth: 1, kind: 'model', attributes: { 'gen_ai.operation.name': 'chat', 'gen_ai.request.model': 'large-2026-09', 'gen_ai.response.finish_reasons': '["tool_calls"]', 'gen_ai.usage.input_tokens': 5120, 'gen_ai.usage.output_tokens': 31, ttft_ms: 690 } },
    { name: `execute_tool ${tool}`, start: 2215, duration: 240, depth: 1, kind: 'tool', attributes: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': tool, [param]: ref, authz: 'allowed' } },
    { name: 'chat large-2026-09', start: 2460, duration: 2890, depth: 1, kind: 'model', attributes: { 'gen_ai.operation.name': 'chat', 'gen_ai.usage.input_tokens': 5390, 'gen_ai.usage.output_tokens': 388, 'gen_ai.response.finish_reasons': '["stop"]', ttft_ms: 410 } },
    { name: 'guardrail.output', start: 5355, duration: 40, depth: 1, kind: 'other', attributes: { 'citations.valid': true, 'pii.redacted': 0 } },
  ]
}

export async function loadTrace(p: Project, read: DataReader): Promise<{ file: string; spans: Span[] }> {
  const { file, ref } = await loadSagaRef(p, read)
  return { file, spans: traceSpans(p, ref) }
}

export function describeSpan(s: Span): string {
  return [`${s.name}  start=${s.start}ms  duration=${s.duration}ms`, ...Object.entries(s.attributes).map(([k, v]) => `  ${k} = ${v}`)].join('\n')
}
