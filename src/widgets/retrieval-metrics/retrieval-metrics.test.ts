import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCorpus } from '../bm25/corpus.ts'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { rankMetrics, relevantGrades } from './metrics.ts'
import { SCENARIOS } from './scenarios.ts'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} is not ${b}`)

test('the metrics at k match a hand calculation', () => {
  const m = rankMetrics([0, 2, 0, 3, 0, 0, 1], 5, [3, 2, 1])
  close(m.recall, 2 / 3)
  close(m.precision, 2 / 5)
  close(m.rr, 1 / 2)
  const dcg = 2 / Math.log2(3) + 3 / Math.log2(5)
  const idcg = 3 + 2 / Math.log2(3) + 1 / Math.log2(4)
  close(m.ndcg, dcg / idcg)
})

test('exponential gain uses 2^grade − 1', () => {
  const m = rankMetrics([1, 3], 2, [3, 1], 'exponential')
  const dcg = 1 + 7 / Math.log2(3)
  const idcg = 7 + 1 / Math.log2(3)
  close(m.ndcg, dcg / idcg)
})

test('a perfect ranking scores 1 under both gains', () => {
  assert.equal(rankMetrics([3, 2, 1], 3, [3, 2, 1]).ndcg, 1)
  assert.equal(rankMetrics([3, 2, 1], 3, [3, 2, 1], 'exponential').ndcg, 1)
})

test('reciprocal rank ignores a result past the cutoff', () => {
  assert.equal(rankMetrics([0, 0, 3], 2, [3]).rr, 0)
  close(rankMetrics([0, 0, 3], 3, [3]).rr, 1 / 3)
})

test('edge cases: nothing relevant, a list shorter than k, and an empty list', () => {
  assert.deepEqual(rankMetrics([0, 0], 2, []), { recall: 0, precision: 0, rr: 0, ndcg: 0 })
  close(rankMetrics([3], 5, [3]).precision, 1 / 5)
  assert.deepEqual(rankMetrics([], 3, [3]), { recall: 0, precision: 0, rr: 0, ndcg: 0 })
})

test('relevantGrades keeps relevant items the list does not show', () => {
  assert.deepEqual(relevantGrades([0, 2, 0, 3]), [2, 3])
  assert.deepEqual(relevantGrades([0, 2], [1]), [2, 1])
})

for (const id of PROJECT_IDS) {
  test(`${id}: the ranking uses real documents and the caption's claim holds`, async () => {
    const s = SCENARIOS[id]
    const { docs } = await loadCorpus(projectOf(id), readerOf(id))
    const known = new Set(docs.map((d) => d.id))
    for (const doc of s.ranked) assert.ok(known.has(doc), `${doc} is not in the dataset`)
    assert.equal(new Set(s.ranked).size, s.ranked.length, 'no document ranked twice')
    for (const doc of Object.keys(s.grades)) assert.ok(s.ranked.includes(doc), `${doc} is graded but not ranked`)

    // "Move a relevant result up to rank 1: reciprocal rank and nDCG rise while Recall@k stays the same."
    const k = 5
    const grades = s.ranked.map((d) => s.grades[d] ?? 0)
    const best = grades.indexOf(3)
    assert.ok(best > 0 && best < k, 'the grade 3 result starts inside k, below rank 1')
    const moved = [grades[best], ...grades.slice(0, best), ...grades.slice(best + 1)]
    const before = rankMetrics(grades, k, relevantGrades(grades))
    const after = rankMetrics(moved, k, relevantGrades(moved))
    assert.equal(after.recall, before.recall)
    assert.ok(after.rr > before.rr)
    assert.ok(after.ndcg > before.ndcg)
  })
}
