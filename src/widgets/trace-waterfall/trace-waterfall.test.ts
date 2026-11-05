import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { TRACE_MS, describeSpan, loadTrace, traceSpans } from './spans.ts'

const SPANS = traceSpans({ id: 'store', company: 'Example Co' }, 'R-1')

test('the root span covers the trace, and every span fits inside it', () => {
  assert.equal(SPANS[0].duration, TRACE_MS)
  for (const s of SPANS) assert.ok(s.start >= 0 && s.start + s.duration <= TRACE_MS, s.name)
})

test('a nested span fits inside the span above it', () => {
  SPANS.forEach((s, i) => {
    if (s.depth !== 2) return
    const parent = SPANS.slice(0, i).reverse().find((p) => p.depth === 1)!
    assert.ok(s.start >= parent.start && s.start + s.duration <= parent.start + parent.duration, `${s.name} in ${parent.name}`)
  })
})

test('the caption’s claims: rerank dominates retrieval, and a model call has a long TTFT', () => {
  const rerank = SPANS.find((s) => s.name === 'retrieval.rerank')!
  const search = SPANS.find((s) => s.name === 'retrieval.search')!
  assert.ok(rerank.duration > search.duration * 5)
  const first = SPANS.find((s) => s.attributes.ttft_ms === 690)!
  assert.ok((first.attributes.ttft_ms as number) > first.duration / 2)
})

test('the tenant becomes a slug, and the tool call names the record', () => {
  assert.equal(SPANS[0].attributes.tenant, 'example-co')
  const tool = SPANS.find((s) => s.kind === 'tool')!
  assert.equal(tool.name, 'execute_tool get_order')
  assert.equal(tool.attributes.order_id, 'R-1')
})

test('the attribute text lists each attribute with the span’s timing', () => {
  const text = describeSpan(SPANS[1])
  assert.match(text, /^gateway\.auth {2}start=5ms {2}duration=18ms/)
  assert.match(text, /quota\.remaining_tpm = 381200/)
})

for (const id of PROJECT_IDS) {
  test(`${id}: the tool span carries a reference from the dataset`, async () => {
    const { file, spans } = await loadTrace(projectOf(id), readerOf(id))
    const [row] = await readerOf(id).csv(file, 1)
    const values = Object.values(spans.find((s) => s.kind === 'tool')!.attributes)
    assert.ok(values.some((v) => Object.values(row).includes(String(v))))
    assert.ok(!String(spans[0].attributes.tenant).includes(' '))
  })
}
