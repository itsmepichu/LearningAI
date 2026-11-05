import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * React widgets that content fragments can embed with
 *   <div data-widget="name" data-props='{"key":"value"}'></div>
 * Each widget is code-split, so a topic only downloads the widgets it uses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgets: Record<string, LazyExoticComponent<ComponentType<any>>> = {
  'loss-landscape-3d': lazy(() => import('./loss-landscape/LossLandscape3D')),
  chunking: lazy(() => import('./chunking/Chunking')),
  bm25: lazy(() => import('./bm25/Bm25')),
  'retrieval-metrics': lazy(() => import('./retrieval-metrics/RetrievalMetrics')),
  'retriever-compare': lazy(() => import('./retriever-compare/RetrieverCompare')),
  streaming: lazy(() => import('./streaming/Streaming')),
  saga: lazy(() => import('./saga/Saga')),
  'context-assembler': lazy(() => import('./context-assembler/ContextAssembler')),
  'memory-sim': lazy(() => import('./memory-sim/MemorySim')),
  'timeout-write': lazy(() => import('./timeout-write/TimeoutWrite')),
  budget: lazy(() => import('./budget/Budget')),
  injection: lazy(() => import('./injection/Injection')),
  'cache-key': lazy(() => import('./cache-key/CacheKey')),
  'isolation-grid': lazy(() => import('./isolation-grid/IsolationGrid')),
  'pii-redact': lazy(() => import('./pii-redact/PiiRedact')),
}
