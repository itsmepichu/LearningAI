import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULTS, TOOL_TIMEOUT_MS, criticalPath } from './path.ts'

test('the default total is the sum along the path, with the slower search counted', () => {
  assert.equal(criticalPath(DEFAULTS).total, 400 + 60 + 800 + 850 + 240 + 2900)
})

test('the parallel searches start together, and only the slower is on the path', () => {
  const { spans, offPath } = criticalPath(DEFAULTS)
  const bm25 = spans.find((s) => s.name === 'BM25')!
  const vector = spans.find((s) => s.name === 'vector search')!
  assert.equal(bm25.start, vector.start)
  assert.equal(bm25.critical, false)
  assert.equal(vector.critical, true)
  assert.equal(offPath, 'BM25')
})

test('the caption’s claim: speeding up a span off the path changes nothing', () => {
  assert.equal(criticalPath({ ...DEFAULTS, bm25: 10 }).total, criticalPath(DEFAULTS).total)
})

test('the same search on the path does change the total', () => {
  assert.equal(criticalPath({ ...DEFAULTS, bm25: 300 }).total, criticalPath(DEFAULTS).total + 240)
  assert.equal(criticalPath({ ...DEFAULTS, bm25: 300 }).offPath, 'vector search')
})

test('a tie puts BM25 on the path', () => {
  const { spans } = criticalPath({ ...DEFAULTS, bm25: 60 })
  assert.equal(spans.find((s) => s.name === 'BM25')!.critical, true)
  assert.equal(spans.find((s) => s.name === 'vector search')!.critical, false)
})

test('the retry adds the timeout to the total and a span to the path', () => {
  const plain = criticalPath(DEFAULTS, 'get_order')
  const retried = criticalPath({ ...DEFAULTS, toolRetry: true }, 'get_order')
  assert.equal(retried.total, plain.total + TOOL_TIMEOUT_MS)
  assert.ok(retried.spans.some((s) => s.name === 'get_order → timeout' && s.kind === 'timeout'))
  assert.ok(retried.spans.some((s) => s.name === 'get_order (retry)'))
})

test('the longest critical span is the second model call by default', () => {
  assert.equal(criticalPath(DEFAULTS).longest.name, 'model call 2 (answer)')
})

test('spans follow one another without gaps', () => {
  const { spans, total } = criticalPath(DEFAULTS)
  const onPath = spans.filter((s) => s.critical)
  onPath.reduce((at, s) => {
    assert.equal(s.start, at, s.name)
    return at + s.duration
  }, 0)
  assert.equal(onPath.reduce((n, s) => n + s.duration, 0), total)
})
