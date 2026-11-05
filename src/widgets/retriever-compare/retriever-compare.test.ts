import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCorpus } from '../bm25/corpus.ts'
import { rankIds } from '../bm25/engine.ts'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { rankMetrics } from '../retrieval-metrics/metrics.ts'
import { COMPARE } from './scenarios.ts'

const LIST = 8

for (const id of PROJECT_IDS) {
  test(`${id}: every ranking uses real documents`, async () => {
    const s = COMPARE[id]
    const { docs } = await loadCorpus(projectOf(id), readerOf(id))
    const known = new Set(docs.map((d) => d.id))
    for (const [name, list] of [['dense', s.dense], ['hybrid', s.hybrid]] as const) {
      assert.equal(list.length, LIST, name)
      assert.equal(new Set(list).size, LIST, `${name} ranks a document twice`)
      for (const doc of list) assert.ok(known.has(doc), `${name}: ${doc} is not in the dataset`)
    }
    for (const doc of Object.keys(s.grades)) assert.ok(known.has(doc), `graded ${doc} is not in the dataset`)
  })

  test(`${id}: the three retrievers differ the way the caption describes`, async () => {
    const s = COMPARE[id]
    const { docs } = await loadCorpus(projectOf(id), readerOf(id))
    const all = Object.values(s.grades)
    const score = (list: string[], k: number) => rankMetrics(list.map((d) => s.grades[d] ?? 0), k, all)
    const lexical = rankIds(docs, s.query, LIST)
    assert.ok(lexical.length > 0, 'BM25 finds something')
    assert.ok(lexical.some((d) => s.grades[d]), 'BM25 finds at least one relevant document')
    // Each single retriever leaves room for hybrid to do better, and hybrid gets the relevant documents to the top.
    assert.equal(score(s.hybrid, 3).ndcg, 1)
    assert.ok(score(lexical, 3).ndcg < 1, 'lexical is not already perfect')
    assert.ok(score(s.dense, 3).ndcg < 1, 'dense is not already perfect')
  })
}
