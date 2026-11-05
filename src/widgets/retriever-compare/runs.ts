import { fuse } from '../rrf/fuse.ts'
import type { CompareScenario } from './scenarios'

export interface Run {
  name: string
  note: string
  list: string[]
}

/**
 * The three columns, and what each honestly is. Without real dense results, dense and hybrid are the hand-written
 * illustration. With them, dense comes from the model and hybrid is RRF over the lists beside it: no reranker runs,
 * so the name must not say one does.
 */
export function compareRuns(s: CompareScenario, lexical: string[], realDense: string[] | null, modelName: string, limit: number): Run[] {
  const bm25: Run = { name: 'Lexical (BM25)', note: 'computed live', list: lexical }
  if (!realDense) {
    return [bm25, { name: 'Dense', note: 'fixed illustration', list: s.dense }, { name: 'Hybrid + rerank', note: 'fixed illustration', list: s.hybrid }]
  }
  return [
    bm25,
    { name: 'Dense', note: `real: ${modelName}, computed on this device`, list: realDense.slice(0, limit) },
    { name: 'Hybrid (RRF, no reranker)', note: 'computed live from the two lists beside it', list: fuse([lexical, realDense], 60).slice(0, limit).map((f) => f.id) },
  ]
}
