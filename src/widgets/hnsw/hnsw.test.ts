import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POINT_COUNT, buildIndex, queryAt, searchIndex } from './graph.ts'

const ix = buildIndex()
const runs = Array.from({ length: 40 }, (_, i) => searchIndex(ix, queryAt(i)))

test('the index is seeded, with a sparse upper layer', () => {
  assert.deepEqual(buildIndex().points, ix.points)
  assert.equal(ix.points.length, POINT_COUNT)
  assert.equal(ix.upperIds.length, 30)
})

test('links go both ways on each layer', () => {
  for (const g of [ix.upper, ix.bottom]) {
    for (const [i, links] of g) for (const j of links) assert.ok(g.get(j)!.includes(i), `${i} and ${j}`)
  }
})

test('a node never links to itself', () => {
  for (const [i, links] of ix.bottom) assert.ok(!links.includes(i))
})

test('queries are repeatable and differ', () => {
  assert.deepEqual(queryAt(3), queryAt(3))
  assert.notDeepEqual(queryAt(3), queryAt(4))
})

test('the caption’s claim: far fewer distance computations than brute force', () => {
  for (const r of runs) assert.ok(r.computed < POINT_COUNT, `${r.computed}`)
  const mean = runs.reduce((n, r) => n + r.computed, 0) / runs.length
  assert.ok(mean < POINT_COUNT / 2, `mean ${mean}`)
})

test('the search is approximate, but usually exact on this small graph', () => {
  const exact = runs.filter((r) => r.found === r.exact).length
  assert.ok(exact >= runs.length * 0.75, `${exact} of ${runs.length}`)
})

test('the trace hops on the upper layer, descends once, then expands', () => {
  for (const r of runs) {
    const kinds = r.trace.map((t) => t.layer)
    assert.equal(kinds.filter((k) => k === 'down').length, 1)
    const down = kinds.indexOf('down')
    assert.ok(kinds.slice(0, down).every((k) => k === 1))
    assert.ok(kinds.slice(down + 1).every((k) => k === 0))
  }
})
