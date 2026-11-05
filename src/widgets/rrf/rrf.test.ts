import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCorpus } from '../bm25/corpus.ts'
import { rankIds } from '../bm25/engine.ts'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { COMPARE } from '../retriever-compare/scenarios.ts'
import { fuse } from './fuse.ts'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} is not ${b}`)

test('the score is the sum of 1 / (k + rank) across the lists', () => {
  const [top] = fuse([['a', 'b'], ['b', 'c']], 60)
  assert.equal(top.id, 'b')
  close(top.score, 1 / 62 + 1 / 61)
  assert.equal(top.lists, 2)
})

test('a document in both lists beats one ranked first in only one', () => {
  const ids = fuse([['x', 'both'], ['y', 'both']], 60).map((f) => f.id)
  assert.equal(ids[0], 'both')
})

test('a small k rewards the top rank, and a large k flattens the differences', () => {
  const gap = (k: number) => {
    const scores = new Map(fuse([['first', 'second']], k).map((f) => [f.id, f.score]))
    return scores.get('first')! / scores.get('second')!
  }
  assert.ok(gap(1) > gap(100))
})

test('ties are broken by id, so the order is stable', () => {
  assert.deepEqual(fuse([['b'], ['a']], 60).map((f) => f.id), ['a', 'b'])
})

test('empty lists are safe', () => {
  assert.deepEqual(fuse([[], []], 60), [])
})

for (const id of PROJECT_IDS) {
  test(`${id}: the caption’s claim holds on the real documents`, async () => {
    const { docs } = await loadCorpus(projectOf(id), readerOf(id))
    const s = COMPARE[id]
    const lexical = rankIds(docs, s.query, 5)
    const dense = s.dense.slice(0, 5)
    const fused = fuse([lexical, dense], 60)
    const both = fused.filter((f) => f.lists === 2).map((f) => f.id)
    assert.ok(both.length >= 2, 'the two rankings overlap')
    assert.deepEqual(fused.slice(0, both.length).map((f) => f.id).sort(), [...both].sort(), 'documents found by both rise to the top')
  })
}
